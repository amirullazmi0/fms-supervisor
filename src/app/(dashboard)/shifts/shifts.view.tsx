'use client';
// Shift kerja: supervisor membuat shift (pagi/sore/…) untuk satu rute, membagi operator + unit, lalu menutup shift.
// Ritase tiap operator dihitung otomatis dari GPS selama shift berjalan.
import { useQueryState } from 'nuqs';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
    CalendarPlus,
    ChevronLeft,
    ChevronRight,
    Clock,
    Pencil,
    Play,
    Plus,
    RotateCcw,
    Square,
    Trash2,
} from 'lucide-react';
import { EmptyState } from '@/components/fleet/Page';
import ShiftCrew from '@/components/fleet/ShiftCrew';
import BreaksEditor from '@/components/fleet/BreaksEditor';
import TemplateManager from '@/components/fleet/TemplateManager';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import { useData, useTick } from '@/provider/StreamProvider';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import type { GlobalApiResponse } from '@/types/api/responses';
import {
    addDays,
    atTime,
    dateKey,
    fmtDate,
    fmtDuration,
    fmtHm,
    fmtNum,
    hmOf,
    truckLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import {
    ConfirmDialog,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Empty, KV, Note, RoutePair, SiteDot, Stat } from '@/components/ui/misc';
import { distanceM } from '@/lib/geo';
import type { Assignment, Route, Shift, ShiftBreak, TripRecord } from '@/types/fleet';

const STATUS: Record<Shift['status'] | 'overdue', { label: string; variant: BadgeVariant }> = {
    planned: { label: 'Rencana', variant: 'outline' },
    active: { label: 'Aktif', variant: 'success' },
    overdue: { label: 'Lewat jam', variant: 'warning' },
    closed: { label: 'Selesai', variant: 'muted' },
};
const statusOf = (s: Shift) => STATUS[s.overdue ? 'overdue' : s.status];

// Operator yang masih bertugas (penugasan belum ditutup), dihitung unik.
const onDuty = (s: Shift) =>
    new Set(s.assignments.filter((a) => a.endAt == null).map((a) => a.driverId)).size;

const span = (s: Pick<Shift, 'plannedStart' | 'plannedEnd'>) => {
    const nextDay = dateKey(s.plannedEnd) !== dateKey(s.plannedStart);
    return `${fmtHm(s.plannedStart)}–${fmtHm(s.plannedEnd)}${nextDay ? ' (+1 hari)' : ''}`;
};

function useRouteLabel() {
    const { routes, sites } = useData();
    return (routeId: string | null) => {
        const r = routes.find((x) => x.id === routeId);
        if (!r) return null;
        const name = (id: string) => sites.find((s) => s.id === id)?.name ?? '?';
        return {
            route: r,
            from: name(r.loadingId),
            to: (r.unloadingIds ?? [r.unloadingId]).map(name).join(' / '),
        };
    };
}

export default function ShiftsView() {
    const { shifts: todayShifts } = useData();
    const { setStats } = useLayout();
    const can = useCan();
    const canCreate = can(P.shiftCreate);

    const [date, setDate] = useState(() => dateKey());
    const [selected, setSelected] = useQueryState('shift'); // ?shift=<id>
    const [creatingQ, setCreatingQ] = useQueryState('baru'); // ?baru=1: langsung buka form shift baru (dari Beranda)
    const creating = creatingQ === '1';
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const [mobileDetail, setMobileDetail] = useState(() => selected != null); // dibuka dari link ?shift= = langsung detail
    const setCreating = (v: boolean) => void setCreatingQ(v ? '1' : null);

    // Shift tanggal yang dipilih (+ yang masih aktif dari tanggal lain). Stream 'shifts' memicu refetch.
    const listQuery = useQueryApiRequest<GlobalApiResponse<Shift[]>>({
        key: 'shifts',
        queries: { from: date, to: date },
    });
    const list = listQuery.data?.data ?? [];

    // Pilih otomatis: shift aktif, bila tidak ada maka yang pertama.
    useEffect(() => {
        // Tunggu data terlebih dahulu agar ?shift= dari tautan tidak terhapus saat daftar masih kosong.
        if (!listQuery.isSuccess) return;
        if (
            selected &&
            (list.some((s) => s.id === selected) || todayShifts.some((s) => s.id === selected))
        )
            return;
        void setSelected((list.find((s) => s.status === 'active') ?? list[0])?.id ?? null);
    }, [list, selected, listQuery.isSuccess, todayShifts, setSelected]);

    useEffect(() => {
        const active = todayShifts.filter((s) => s.status === 'active');
        const asg = new Set(
            active.flatMap((s) =>
                s.assignments.filter((a) => a.endAt == null).map((a) => a.driverId),
            ),
        ).size;
        const overdue = active.filter((s) => s.overdue).length;
        setStats(
            <>
                <HeaderStat label="Shift aktif" value={active.length} />
                <HeaderStat label="Operator bertugas" value={asg} />
                {overdue > 0 && <HeaderStat label="Lewat jam" value={overdue} tone="danger" />}
            </>,
        );
    }, [setStats, todayShifts]);
    useEffect(() => () => setStats(null), [setStats]);

    const isToday = date === dateKey();
    const shown = list.filter((s) => s.date === date);
    const otherActive = list.filter((s) => s.date !== date && s.status === 'active');

    // HP / tablet: daftar dan detail gantian (bukan ditumpuk). Detail tampil setelah shift dipilih.
    const pick = (id: string) => {
        void setSelected(id);
        setMobileDetail(true);
    };

    return (
        <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
            <aside
                className={cn(
                    'flex shrink-0 flex-col gap-4 border-b bg-card p-4 lg:flex lg:w-[360px] lg:overflow-y-auto lg:border-b-0 lg:border-r',
                    mobileDetail && 'max-lg:hidden',
                )}
                aria-label="Daftar shift"
            >
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setDate(addDays(date, -1))}
                            aria-label="Hari sebelumnya"
                        >
                            <ChevronLeft />
                        </Button>
                        <Input
                            type="date"
                            className="flex-1"
                            value={date}
                            onChange={(e) => e.target.value && setDate(e.target.value)}
                            aria-label="Tanggal"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setDate(addDays(date, 1))}
                            aria-label="Hari berikutnya"
                        >
                            <ChevronRight />
                        </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                            {fmtDate(date)}
                            {!isToday && (
                                <button
                                    type="button"
                                    className="ml-2 text-xs font-medium text-info hover:underline"
                                    onClick={() => setDate(dateKey())}
                                >
                                    Hari ini
                                </button>
                            )}
                        </span>
                        {can(P.shiftTemplateRead) && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTemplatesOpen(true)}
                            >
                                Template
                            </Button>
                        )}
                        {canCreate && (
                            <Button size="sm" onClick={() => setCreating(true)}>
                                <Plus /> Shift
                            </Button>
                        )}
                    </div>

                    {otherActive.length > 0 && (
                        <>
                            <span className="text-xs text-muted-foreground">
                                Masih aktif dari tanggal lain
                            </span>
                            <ShiftList
                                shifts={otherActive}
                                selected={selected}
                                onSelect={pick}
                                showDate
                            />
                        </>
                    )}
                    {shown.length === 0 ? (
                        <EmptyState
                            icon={CalendarPlus}
                            title="Belum ada shift di tanggal ini"
                            action={
                                canCreate ? (
                                    <Button size="sm" onClick={() => setCreating(true)}>
                                        <Plus /> Buat shift
                                    </Button>
                                ) : undefined
                            }
                        >
                            Shift dibuat per rute / fleet, mis. Pagi atau Malam. Bisa beberapa rute
                            sekaligus.
                        </EmptyState>
                    ) : (
                        <ShiftList shifts={shown} selected={selected} onSelect={pick} />
                    )}
                </div>
            </aside>

            <section
                className={cn(
                    'min-w-0 flex-1 p-4 md:p-6 lg:block lg:overflow-y-auto',
                    !mobileDetail && 'max-lg:hidden',
                )}
            >
                <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 -ml-2 lg:hidden"
                    onClick={() => setMobileDetail(false)}
                >
                    <ChevronLeft /> Daftar shift
                </Button>
                {selected ? (
                    <ShiftDetail
                        key={selected}
                        id={selected}
                        others={[...list, ...todayShifts]}
                        onGone={() => {
                            void setSelected(null);
                            setMobileDetail(false);
                        }}
                    />
                ) : (
                    <EmptyState icon={CalendarPlus} title="Pilih shift" className="mt-6">
                        Pilih shift di daftar, atau buat shift baru.
                    </EmptyState>
                )}
            </section>

            <TemplateManager open={templatesOpen} onOpenChange={setTemplatesOpen} />
            <ShiftForm
                open={creating}
                date={date}
                onOpenChange={setCreating}
                onSaved={(s) => {
                    setCreating(false);
                    pick(s.id);
                }}
            />
        </div>
    );
}

function ShiftList({
    shifts,
    selected,
    onSelect,
    showDate = false,
}: {
    shifts: Shift[];
    selected: string | null;
    onSelect: (id: string) => void;
    showDate?: boolean;
}) {
    const routeOf = useRouteLabel();
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {shifts.map((s) => {
                const st = statusOf(s);
                const r = routeOf(s.routeId);
                const sel = s.id === selected;
                return (
                    <li key={s.id}>
                        <button
                            type="button"
                            aria-pressed={sel}
                            onClick={() => onSelect(s.id)}
                            className={cn(
                                'flex w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:border-ring',
                                sel && 'border-info ring-3 ring-info/15',
                            )}
                        >
                            <span className="flex items-center justify-between gap-2">
                                <b className="text-sm">
                                    Shift {s.name}
                                    {showDate ? ` · ${s.date}` : ''}
                                </b>
                                <Badge variant={st.variant}>{st.label}</Badge>
                            </span>
                            {r ? (
                                <RoutePair from={r.from} to={r.to} />
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    Belum ada rute
                                </span>
                            )}
                            <span className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1 font-mono">
                                    <Clock className="size-3.5" /> {span(s)}
                                </span>
                                <span>{onDuty(s)} operator</span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

// ---------- Buat / ubah shift (dialog) ----------
function ShiftForm({
    open,
    onOpenChange,
    date,
    shift,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    date: string;
    shift?: Shift;
    onSaved: (s: Shift) => void;
}) {
    const { templates, routes } = useData();
    const toast = useToast();
    const routeOf = useRouteLabel();
    const init = () => ({
        name: shift?.name ?? '',
        routeId: shift?.routeId ?? (routes.length === 1 ? routes[0].id : ''),
        // Shift baru: bisa langsung beberapa rute sekaligus (1 shift per rute), crew disalin dari shift sebelumnya.
        routeIds: shift ? [] : routes.length === 1 ? [routes[0].id] : [],
        copyCrew: true,
        date: shift?.date ?? date,
        start: shift ? hmOf(shift.plannedStart) : '06:00',
        end: shift ? hmOf(shift.plannedEnd) : '14:00',
        autoClose: shift?.autoClose ?? true,
        note: shift?.note ?? '',
        breaks: (shift?.breaks ?? []) as ShiftBreak[],
    });
    const [form, setForm] = useState(init);
    const [saving, setSaving] = useState(false);
    type Body = {
        name: string;
        routeId: string;
        plannedStart: number;
        plannedEnd: number;
        autoClose: boolean;
        note: string;
        breaks: ShiftBreak[];
        date?: string;
    };
    const create = useMutationApiRequest<GlobalApiResponse<Shift>, Body>({
        key: 'shifts-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<Shift>, Body>({
        key: 'shifts-update',
        params: () => ({ id: shift?.id ?? '' }),
        config: SILENT,
    });
    const copy = useMutationApiRequest<
        GlobalApiResponse<{ from: string; added: number; skipped: string[] }>,
        { __params: { id: string } }
    >({ key: 'shifts-copy-previous', config: SILENT });
    // Form diisi ulang tiap dialog dibuka.
    useEffect(() => {
        if (open) setForm(init());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm({ ...form, [k]: v });
    const overnight = form.end <= form.start;
    const r = routeOf(form.routeId);
    const started = shift != null && shift.status !== 'planned';

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const plannedStart = atTime(form.date, form.start);
            const plannedEnd = atTime(overnight ? addDays(form.date, 1) : form.date, form.end);
            const base = {
                name: form.name.trim(),
                plannedStart,
                plannedEnd,
                autoClose: form.autoClose,
                note: form.note,
                breaks: form.breaks,
            };
            if (shift) {
                const s = (await update.mutateAsync({ ...base, routeId: form.routeId })).data!;
                toast({ title: 'Shift diubah', body: `${r?.route.name ?? ''} · ${span(s)}` });
                onSaved(s);
                return;
            }
            // 1 shift per rute yang dicentang, lalu (opsional) salin operator + unit dari shift sebelumnya di rute itu.
            const made: Shift[] = [];
            let crew = 0;
            for (const routeId of form.routeIds) {
                const s = (await create.mutateAsync({ ...base, routeId, date: form.date })).data!;
                made.push(s);
                if (form.copyCrew) {
                    const c = await copy.mutateAsync({ __params: { id: s.id } }).catch(() => null);
                    crew += c?.data?.added ?? 0;
                }
            }
            toast({
                title:
                    made.length === 1
                        ? `Shift ${made[0].name} dibuat`
                        : `${made.length} shift ${base.name} dibuat`,
                body: `${span(made[0])}${form.copyCrew ? ` · ${crew} penugasan disalin dari shift sebelumnya` : ''}`,
            });
            onSaved(made[0]);
        } catch (err) {
            toast({
                title: shift ? 'Gagal mengubah shift' : 'Gagal membuat shift',
                body: errText(err),
                level: 'crit',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
                    <DialogHeader>
                        <DialogTitle>
                            {shift ? `Ubah shift ${shift.name}` : 'Shift baru'}
                        </DialogTitle>
                        <DialogDescription>
                            {shift
                                ? '1 shift = 1 rute / fleet.'
                                : 'Pilih satu atau beberapa rute: tiap rute jadi 1 shift. Operator & unit bisa langsung disalin dari shift sebelumnya.'}
                        </DialogDescription>
                    </DialogHeader>

                    {!shift && templates.length > 0 && (
                        <div
                            className="flex flex-wrap gap-1.5"
                            role="group"
                            aria-label="Template shift"
                        >
                            {templates.map((t) => {
                                const on =
                                    form.name === t.name &&
                                    form.start === t.startTime &&
                                    form.end === t.endTime;
                                return (
                                    <Button
                                        key={t.id}
                                        type="button"
                                        size="sm"
                                        variant={on ? 'brand' : 'outline'}
                                        className="rounded-full"
                                        onClick={() =>
                                            setForm({
                                                ...form,
                                                name: t.name,
                                                start: t.startTime,
                                                end: t.endTime,
                                                autoClose: t.autoClose,
                                                breaks: t.breaks ?? [],
                                            })
                                        }
                                    >
                                        {t.name}{' '}
                                        <span className="font-mono text-xs opacity-70">
                                            {t.startTime}–{t.endTime}
                                        </span>
                                    </Button>
                                );
                            })}
                        </div>
                    )}

                    {shift ? (
                        <Field
                            label="Rute / fleet"
                            hint={
                                started
                                    ? 'Rute tidak dapat diganti setelah shift dimulai.'
                                    : undefined
                            }
                        >
                            <Combobox
                                value={form.routeId}
                                onChange={(v) => set('routeId', v)}
                                options={routes.map((x) => ({ value: x.id, label: x.name }))}
                                placeholder="Pilih rute…"
                                searchPlaceholder="Cari rute…"
                                empty="Belum ada rute. Buat di menu Pit, stockpile / jetty & rute."
                                disabled={started}
                                aria-label="Rute"
                            />
                        </Field>
                    ) : (
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-1 flex w-full items-center justify-between text-sm text-muted-foreground">
                                <span>Rute / fleet ({form.routeIds.length} dipilih)</span>
                                {routes.length > 1 && (
                                    <button
                                        type="button"
                                        className="text-xs font-medium text-info hover:underline"
                                        onClick={() =>
                                            set(
                                                'routeIds',
                                                form.routeIds.length === routes.length
                                                    ? []
                                                    : routes.map((x) => x.id),
                                            )
                                        }
                                    >
                                        {form.routeIds.length === routes.length
                                            ? 'Kosongkan'
                                            : 'Pilih semua'}
                                    </button>
                                )}
                            </legend>
                            {routes.length === 0 ? (
                                <Note tone="warning">
                                    Belum ada rute. Buat di menu Pit, stockpile / jetty & rute.
                                </Note>
                            ) : (
                                <div className="grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2">
                                    {routes.map((x) => {
                                        const on = form.routeIds.includes(x.id);
                                        return (
                                            <Label
                                                key={x.id}
                                                className={cn(
                                                    'min-h-11 cursor-pointer gap-2.5 rounded-lg border px-3 py-2 font-normal',
                                                    on && 'border-info bg-info-soft',
                                                )}
                                            >
                                                <Checkbox
                                                    checked={on}
                                                    onCheckedChange={(v) =>
                                                        set(
                                                            'routeIds',
                                                            v
                                                                ? [...form.routeIds, x.id]
                                                                : form.routeIds.filter(
                                                                      (id) => id !== x.id,
                                                                  ),
                                                        )
                                                    }
                                                />
                                                <span className="truncate">{x.name}</span>
                                            </Label>
                                        );
                                    })}
                                </div>
                            )}
                            <Label className="min-h-11 gap-2.5 rounded-lg border px-3 py-2 font-normal">
                                <Checkbox
                                    checked={form.copyCrew}
                                    onCheckedChange={(v) => set('copyCrew', Boolean(v))}
                                />
                                <span className="flex flex-col">
                                    <span>Salin penugasan dari shift sebelumnya</span>
                                    <span className="text-xs text-muted-foreground">
                                        Operator & unit yang sama dengan shift terakhir di rute itu
                                        (yang bentrok dilewati).
                                    </span>
                                </span>
                            </Label>
                        </fieldset>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Nama shift">
                            <Input
                                value={form.name}
                                onChange={(e) => set('name', e.target.value)}
                                placeholder="Pagi"
                                maxLength={40}
                                required
                                autoComplete="off"
                            />
                        </Field>
                        <Field label="Tanggal kerja">
                            <Input
                                type="date"
                                value={form.date}
                                onChange={(e) => e.target.value && set('date', e.target.value)}
                                required
                                disabled={Boolean(shift)}
                            />
                        </Field>
                        <Field label="Mulai">
                            <Input
                                type="time"
                                value={form.start}
                                onChange={(e) => set('start', e.target.value)}
                                required
                                disabled={started}
                            />
                        </Field>
                        <Field label="Selesai">
                            <Input
                                type="time"
                                value={form.end}
                                onChange={(e) => set('end', e.target.value)}
                                required
                            />
                        </Field>
                    </div>
                    {overnight && (
                        <Note tone="info">
                            Jam selesai lebih kecil dari jam mulai, jadi shift selesai besoknya.
                        </Note>
                    )}
                    {shift && form.name && r && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-[13px]">
                            <b>Shift {form.name}</b> untuk rute{' '}
                            <RoutePair from={r.from} to={r.to} />
                        </div>
                    )}
                    <Label className="justify-between rounded-lg border p-3">
                        <span className="flex flex-col gap-1">
                            <span>Tutup otomatis di jam selesai</span>
                            <span className="text-xs font-normal text-muted-foreground">
                                {form.autoClose
                                    ? 'Shift selesai sendiri. Bisa diperpanjang sebelum itu.'
                                    : 'Shift terus berjalan sampai ditutup manual. Bila melewati jam selesai, muncul peringatan.'}
                            </span>
                        </span>
                        <Switch
                            checked={form.autoClose}
                            onCheckedChange={(v) => set('autoClose', v)}
                        />
                    </Label>
                    <BreaksEditor value={form.breaks} onChange={(v) => set('breaks', v)} />
                    <Field label="Catatan">
                        <Input
                            value={form.note}
                            onChange={(e) => set('note', e.target.value)}
                            maxLength={200}
                            autoComplete="off"
                        />
                    </Field>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                saving || (shift ? !form.routeId : form.routeIds.length === 0)
                            }
                        >
                            {saving
                                ? 'Menyimpan…'
                                : shift
                                  ? 'Simpan'
                                  : form.routeIds.length > 1
                                    ? `Buat ${form.routeIds.length} shift`
                                    : 'Buat shift'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ---------- Detail shift ----------
// Pit & stockpile / jetty rute shift ini: excavator di tiap lokasi, DT yang dituju ke tiap jetty,
// dan ritasenya.
function ShiftJetties({
    shift,
    route,
    trips,
}: {
    shift: Shift;
    route: Route;
    trips: TripRecord[];
}) {
    const { sites, devices, drivers } = useData();
    const ids = route.unloadingIds ?? [route.unloadingId];
    const pit = sites.find((x) => x.id === route.loadingId);
    const open = shift.assignments.filter((a) => a.endAt == null);
    const isEx = (a: Assignment) => devices[a.imei]?.unitType === 'EX';
    const exAt = (siteId: string) =>
        open.filter((a) => isEx(a) && (a.workSiteId ?? route.loadingId) === siteId);
    const avgMs = (xs: TripRecord[]) =>
        xs.length ? fmtDuration(xs.reduce((n, t) => n + t.durationMs, 0) / xs.length) : '—';
    const unitList = (list: Assignment[], empty: string) =>
        list.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {list.map((a) => {
                    const d = drivers.find((x) => x.id === a.driverId);
                    const t = devices[a.imei];
                    return (
                        <li key={a.id}>
                            <Badge variant="muted">
                                {t ? truckLabel(t) : a.imei}
                                {d ? ` · ${d.name}` : ''}
                            </Badge>
                        </li>
                    );
                })}
            </ul>
        ) : (
            <Empty className="text-xs">{empty}</Empty>
        );
    const pitEx = pit ? exAt(pit.id) : [];

    return (
        <section className="flex flex-col gap-3" aria-label="Pit & stockpile / jetty">
            <h3 className="m-0 text-[15px] font-semibold">
                Pit &amp; stockpile / jetty{' '}
                <span className="font-normal text-muted-foreground">
                    · {ids.length} tujuan · {open.filter(isEx).length} excavator
                </span>
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
                {pit && (
                    <Card className="gap-3 px-4 py-4">
                        <div className="flex items-center gap-2">
                            <SiteDot type="loading" className="size-5 text-[10px]" />
                            <b className="min-w-0 flex-1 truncate">{pit.name}</b>
                            <Badge variant="outline">Pit</Badge>
                        </div>
                        <KV
                            rows={[
                                ['Radius', `${pit.radius} m`],
                                ['Excavator', `${pitEx.length} unit`],
                                ['DT bertugas', `${open.filter((a) => !isEx(a)).length} unit`],
                            ]}
                        />
                        {unitList(pitEx, 'Belum ada excavator di pit.')}
                    </Card>
                )}
                {ids.map((id, i) => {
                    const site = sites.find((x) => x.id === id);
                    const name = site?.name ?? '?';
                    const units = open.filter((a) => !isEx(a) && (a.unloadingId ?? ids[0]) === id);
                    const exs = exAt(id);
                    const go = trips.filter(
                        (t) => t.leg === 'go' && t.status === 'done' && t.unloadingName === name,
                    );
                    const back = trips.filter(
                        (t) => t.leg === 'back' && t.status === 'done' && t.loadingName === name,
                    );
                    const dist = site && pit ? distanceM(pit, site) : null;
                    return (
                        <Card key={id} className="gap-3 px-4 py-4">
                            <div className="flex items-center gap-2">
                                <SiteDot type="unloading" className="size-5 text-[10px]" />
                                <b className="min-w-0 flex-1 truncate">{name}</b>
                                {i === 0 && ids.length > 1 && (
                                    <Badge variant="outline">Utama</Badge>
                                )}
                            </div>
                            <KV
                                rows={[
                                    [
                                        'Jarak lurus dari pit',
                                        dist == null
                                            ? '—'
                                            : dist < 1000
                                              ? `${Math.round(dist)} m`
                                              : `${(dist / 1000).toFixed(1)} km`,
                                    ],
                                    ['Radius', site ? `${site.radius} m` : '—'],
                                    [
                                        'Excavator',
                                        exs.length
                                            ? `${exs.length} unit`
                                            : 'Tidak ada (dumping langsung)',
                                    ],
                                    ['DT dituju', `${units.length} unit`],
                                    ['Ritase selesai', `${go.length} · ${back.length} return`],
                                    ['Rata-rata hauling', avgMs(go)],
                                    ['Rata-rata return', avgMs(back)],
                                ]}
                            />
                            {exs.length > 0 && unitList(exs, '')}
                            {unitList(units, 'Belum ada DT yang dituju ke sini.')}
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}

function ShiftDetail({ id, others, onGone }: { id: string; others: Shift[]; onGone: () => void }) {
    const toast = useToast();
    const { routes } = useData();
    const routeOf = useRouteLabel();
    const can = useCan();
    const [editing, setEditing] = useState(false);
    const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null);
    useTick(30000);

    // Stream 'shifts' / 'trips' refetches this (StreamProvider).
    const query = useQueryApiRequest<GlobalApiResponse<{ shift: Shift; trips: TripRecord[] }>>({
        key: 'shifts-by-id',
        params: { id },
        config: { errorNotification: false },
        options: { retry: false },
    });
    const data = query.data?.data ?? null;
    useEffect(() => {
        if (query.isError) onGone();
    }, [query.isError, onGone]);
    const load = () => void query.refetch();

    const start = useMutationApiRequest<GlobalApiResponse<Shift>, void>({
        key: 'shifts-start',
        params: { id },
        config: SILENT,
    });
    const close = useMutationApiRequest<GlobalApiResponse<Shift>, void>({
        key: 'shifts-close',
        params: { id },
        config: SILENT,
    });
    const reopen = useMutationApiRequest<GlobalApiResponse<Shift>, void>({
        key: 'shifts-reopen',
        params: { id },
        config: SILENT,
    });
    const update = useMutationApiRequest<
        GlobalApiResponse<Shift>,
        { plannedStart: number; plannedEnd: number }
    >({ key: 'shifts-update', params: { id }, config: SILENT });
    const del = useMutationApiRequest<GlobalApiResponse<{ id: string }>, void>({
        key: 'shifts-delete',
        params: { id },
        config: SILENT,
    });
    const actions = { start, close, reopen };

    const act = async (path: keyof typeof actions, ok: string) => {
        try {
            await actions[path].mutateAsync();
            toast({ title: ok });
        } catch (err) {
            toast({ title: 'Gagal', body: errText(err), level: 'crit' });
        }
    };
    const extend = async (minutes: number) => {
        if (!data) return;
        try {
            const plannedEnd = Math.max(data.shift.plannedEnd, Date.now()) + minutes * 60e3;
            await update.mutateAsync({ plannedStart: data.shift.plannedStart, plannedEnd });
            toast({ title: 'Shift diperpanjang', body: `Selesai jadi ${fmtHm(plannedEnd)}` });
        } catch (err) {
            toast({ title: 'Gagal memperpanjang', body: errText(err), level: 'crit' });
        }
    };
    const remove = async () => {
        try {
            await del.mutateAsync();
            toast({ title: 'Shift dihapus', level: 'warn' });
            onGone();
        } catch (err) {
            toast({ title: 'Gagal', body: errText(err), level: 'crit' });
        }
    };

    if (!data) return <Empty>Memuat shift…</Empty>;
    const { shift: s, trips } = data;
    const route: Route | undefined = routes.find((r) => r.id === s.routeId);
    const r = routeOf(s.routeId);
    const st = statusOf(s);
    const done = trips.filter((t) => t.leg === 'go' && t.status === 'done');
    const back = trips.filter((t) => t.leg === 'back' && t.status === 'done');
    const unit = trips.find((t) => t.fuelUnit)?.fuelUnit ?? null;
    const fuelTotal = trips.reduce((n, t) => n + (t.fuelUsed ?? 0), 0);
    const avg = done.length ? done.reduce((n, t) => n + t.durationMs, 0) / done.length : 0;
    const backAvg = back.length ? back.reduce((n, t) => n + t.durationMs, 0) / back.length : 0;
    const running = trips.filter((t) => t.status !== 'done').length;
    const canOperate = can(P.shiftOperate);
    const canUpdate = can(P.shiftUpdate);
    const canEdit = canOperate || canUpdate || can(P.shiftDelete);
    const editable = can(P.assignmentManage) && s.status !== 'closed';

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
            <Card className="gap-3 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex items-center gap-2.5">
                            <h2 className="m-0 text-xl font-bold tracking-tight">Shift {s.name}</h2>
                            <Badge variant={st.variant}>{st.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-muted-foreground">untuk rute</span>
                            <b>{route?.name ?? '—'}</b>
                            {r && (
                                <RoutePair
                                    from={r.from}
                                    to={r.to}
                                    className="text-muted-foreground"
                                />
                            )}
                        </div>
                    </div>
                    {canEdit && (
                        <div className="flex flex-wrap items-center gap-2">
                            {canOperate && s.status === 'planned' && (
                                <Button onClick={() => void act('start', 'Shift dimulai')}>
                                    <Play /> Mulai sekarang
                                </Button>
                            )}
                            {canUpdate && s.status === 'active' && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void extend(30)}
                                    >
                                        +30 menit
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void extend(60)}
                                    >
                                        +1 jam
                                    </Button>
                                </>
                            )}
                            {canUpdate && s.status !== 'closed' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditing(true)}
                                >
                                    <Pencil /> Ubah
                                </Button>
                            )}
                            {canOperate && s.status === 'closed' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void act('reopen', 'Shift dibuka kembali')}
                                >
                                    <RotateCcw /> Buka kembali
                                </Button>
                            )}
                            {canOperate && s.status === 'active' && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setConfirm('close')}
                                >
                                    <Square /> Selesai shift
                                </Button>
                            )}
                            {can(P.shiftDelete) && s.status === 'planned' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setConfirm('delete')}
                                >
                                    <Trash2 /> Hapus
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
                    <span>{fmtDate(s.date)}</span>
                    <span>
                        Rencana <b className="font-mono text-foreground">{span(s)}</b>
                    </span>
                    {s.startedAt && (
                        <span>
                            Mulai <b className="font-mono text-foreground">{fmtHm(s.startedAt)}</b>
                        </span>
                    )}
                    {s.closedAt && (
                        <span>
                            Selesai <b className="font-mono text-foreground">{fmtHm(s.closedAt)}</b>
                            {s.closeReason === 'auto' ? ' (otomatis)' : ''}
                        </span>
                    )}
                    <span>{s.autoClose ? 'Tutup otomatis' : 'Tutup manual'}</span>
                </div>
                {s.note && <Empty>{s.note}</Empty>}
                {s.overdue && (
                    <Note>
                        Shift sudah melewati jam selesai ({fmtHm(s.plannedEnd)}) dan masih berjalan.
                        Tutup atau perpanjang.
                    </Note>
                )}
            </Card>

            <section
                className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
                aria-label="Ringkasan shift"
            >
                <Stat label="Operator bertugas" value={onDuty(s)} />
                <Stat
                    label="Ritase (hauling)"
                    value={done.length}
                    sub={`${back.length} return${running ? ` · ${running} sedang berjalan` : ''}`}
                />
                <Stat
                    label="Rata-rata hauling"
                    value={done.length ? fmtDuration(avg) : '—'}
                    sub={r ? `${r.from} → ${r.to}` : undefined}
                />
                <Stat
                    label="Rata-rata return"
                    value={back.length ? fmtDuration(backAvg) : '—'}
                    sub={r ? `${r.to} → ${r.from}` : undefined}
                />
                <Stat label="BBM terpakai" value={unit ? `${fmtNum(fuelTotal, 1)} ${unit}` : '—'} />
            </section>

            {route && <ShiftJetties shift={s} route={route} trips={trips} />}

            <ShiftCrew
                shift={s}
                route={route}
                others={others}
                trips={trips}
                editable={editable}
                onChanged={load}
            />

            <ShiftForm
                open={editing}
                onOpenChange={setEditing}
                date={s.date}
                shift={s}
                onSaved={() => {
                    setEditing(false);
                    load();
                }}
            />
            <ConfirmDialog
                open={confirm === 'close'}
                onOpenChange={(o) => !o && setConfirm(null)}
                title={`Selesaikan shift ${s.name}?`}
                description="Ritase yang sudah berangkat sebelum shift ditutup tetap dihitung ke shift ini meskipun tiba belakangan."
                confirmLabel="Ya, selesai"
                destructive
                onConfirm={() => void act('close', 'Shift selesai')}
            />
            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(o) => !o && setConfirm(null)}
                title={`Hapus shift ${s.name}?`}
                description="Shift ini belum mulai. Penugasannya ikut kehapus."
                confirmLabel="Hapus"
                destructive
                onConfirm={() => void remove()}
            />
        </div>
    );
}
