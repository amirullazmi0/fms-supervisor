'use client';
// Daftar operator: tambah, ubah, nonaktifkan, atur PIN tablet MDT. Operator tidak login
// ke dashboard; datanya dipakai untuk penugasan, laporan, dan login di MDT kabin (NIK + PIN).
import { useMemo, useState } from 'react';
import { useNow } from '@/lib/useNow';
import type { FormEvent } from 'react';
import { KeyRound, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { ACTIVITY_TONE, activityOf } from '@/lib/activity';
import type { Activity } from '@/lib/activity';
import { P, useCan } from '@/lib/permissions';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { fmtDuration, fmtHm, truckLabel } from '@/lib/format';
import { DELAY_TONE } from '@/lib/labels';
import { useToast } from '@/components/fleet/Toasts';
import { useData } from '@/provider/StreamProvider';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import type { GlobalApiResponse } from '@/types/api/responses';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, SearchInput } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/checkbox';
import {
    ConfirmDialog,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, Empty } from '@/components/ui/misc';
import type { Driver, UnitStatusLog } from '@/types/fleet';

interface Form {
    name: string;
    employeeNo: string;
    phone: string;
    ibutton: string;
    active: boolean;
    note: string;
}

// Status tugas operator: dari penugasan shift (aktif = bertugas, belum mulai = terjadwal).
type DutyState = 'onDuty' | 'planned' | 'free' | 'inactive';

const DUTY_LABEL: Record<DutyState, { label: string; tone: string }> = {
    onDuty: { label: 'Bertugas', tone: 'bg-success-soft text-success' },
    planned: { label: 'Terjadwal', tone: 'bg-info-soft text-info' },
    free: { label: 'Tidak bertugas', tone: 'bg-muted text-muted-foreground' },
    inactive: { label: 'Nonaktif', tone: 'bg-muted text-muted-foreground' },
};
const DUTY_ORDER: Record<DutyState, number> = { onDuty: 0, planned: 1, free: 2, inactive: 3 };

interface OperatorDuty {
    state: 'onDuty' | 'planned';
    shiftName: string;
    plannedStart: number;
    unit: string;
    routeName: string;
    mdt: UnitStatusLog | null; // status yang dipilih di MDT (unit yang dia bawa)
    activity: Activity | null; // aktivitas & lokasi saat ini (dari GPS unitnya), hanya bila bertugas
}

// driverId → tugasnya. Shift aktif menang atas yang terjadwal; yang terjadwal ambil yang paling dekat.
function useOperatorDuty(): Map<string, OperatorDuty> {
    const { shifts, routes, devices, sites } = useData();
    const can = useCan();
    const current = useQueryApiRequest<GlobalApiResponse<UnitStatusLog[]>>({
        key: 'unit-status-current',
        config: { errorNotification: false },
        options: { enabled: can(P.deviceRead) || can(P.reportRead), refetchInterval: 60000 },
    });
    return useMemo(() => {
        const status = new Map((current.data?.data ?? []).map((l) => [l.imei, l]));
        const routeById = new Map(routes.map((r) => [r.id, r]));
        const siteById = new Map(sites.map((s) => [s.id, s]));
        const m = new Map<string, OperatorDuty>();
        const sorted = [...shifts]
            .filter((s) => s.status !== 'closed')
            .sort((a, b) => a.plannedStart - b.plannedStart);
        for (const s of sorted) {
            const state = s.status === 'active' ? 'onDuty' : 'planned';
            for (const a of s.assignments) {
                if (a.endAt != null) continue;
                const prev = m.get(a.driverId);
                if (prev && (prev.state === 'onDuty' || state === 'planned')) continue;
                const dev = devices[a.imei];
                const route = routeById.get(a.routeId);
                m.set(a.driverId, {
                    state,
                    shiftName: s.name,
                    plannedStart: s.plannedStart,
                    unit: dev ? truckLabel(dev) : a.imei,
                    routeName: route?.name ?? '-',
                    mdt: state === 'onDuty' ? (status.get(a.imei) ?? null) : null,
                    activity:
                        state === 'onDuty'
                            ? activityOf(
                                  dev,
                                  siteById.get(route?.loadingId ?? ''),
                                  siteById.get(a.unloadingId ?? route?.unloadingId ?? ''),
                              )
                            : null,
                });
            }
        }
        return m;
    }, [shifts, routes, devices, sites, current.data]);
}

const empty: Form = { name: '', employeeNo: '', phone: '', ibutton: '', active: true, note: '' };
const formOf = (d: Driver): Form => ({
    name: d.name,
    employeeNo: d.employeeNo ?? '',
    phone: d.phone ?? '',
    ibutton: d.ibutton ?? '',
    active: d.active,
    note: d.note ?? '',
});

export default function DriverManager({ canEdit }: { canEdit: boolean }) {
    const { drivers } = useData();
    const toast = useToast();
    const [q, setQ] = useState('');
    const [form, setForm] = useState<Form | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Driver | null>(null);
    const [pinFor, setPinFor] = useState<Driver | null>(null);
    const can = useCan();
    const create = useMutationApiRequest<GlobalApiResponse<Driver>, Form>({
        key: 'drivers-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<Driver>, Form>({
        key: 'drivers-update',
        params: () => ({ id: editing ?? '' }),
        config: SILENT,
    });
    const del = useMutationApiRequest<
        GlobalApiResponse<{ result: 'deleted' | 'deactivated' }>,
        { __params: { id: string } }
    >({ key: 'drivers-delete', config: SILENT });

    const duty = useOperatorDuty();
    const now = useNow(30000);
    const [filter, setFilter] = useState<'all' | DutyState>('all');
    const counts = drivers.reduce<Record<DutyState, number>>(
        (m, d) => (m[duty.get(d.id)?.state ?? (d.active ? 'free' : 'inactive')]++, m),
        { onDuty: 0, planned: 0, free: 0, inactive: 0 },
    );
    const shown = drivers
        .filter(
            (d) =>
                !q ||
                `${d.name} ${d.employeeNo ?? ''} ${d.phone ?? ''}`
                    .toLowerCase()
                    .includes(q.toLowerCase()),
        )
        .filter(
            (d) =>
                filter === 'all' ||
                (duty.get(d.id)?.state ?? (d.active ? 'free' : 'inactive')) === filter,
        )
        .sort(
            (a, b) =>
                DUTY_ORDER[duty.get(a.id)?.state ?? (a.active ? 'free' : 'inactive')] -
                DUTY_ORDER[duty.get(b.id)?.state ?? (b.active ? 'free' : 'inactive')],
        );
    const set = <K extends keyof Form>(k: K, v: Form[K]) => form && setForm({ ...form, [k]: v });
    const close = () => {
        setForm(null);
        setEditing(null);
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!form) return;
        setSaving(true);
        try {
            const d = (editing ? await update.mutateAsync(form) : await create.mutateAsync(form))
                .data;
            toast({
                title: editing ? 'Operator diubah' : 'Operator ditambah',
                body: d?.name ?? form.name,
            });
            close();
        } catch (err) {
            toast({ title: 'Gagal menyimpan data operator', body: errText(err), level: 'crit' });
        } finally {
            setSaving(false);
        }
    };

    const remove = async (d: Driver) => {
        try {
            const r = (await del.mutateAsync({ __params: { id: d.id } })).data!;
            toast({
                title: r.result === 'deleted' ? 'Operator dihapus' : 'Operator dinonaktifkan',
                body:
                    r.result === 'deleted'
                        ? d.name
                        : `${d.name} pernah ditugaskan, jadi datanya disimpan untuk laporan.`,
                level: 'warn',
            });
        } catch (err) {
            toast({ title: 'Gagal', body: errText(err), level: 'crit' });
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <SearchInput
                    className="flex-1"
                    placeholder="Cari operator…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Cari operator"
                />
                {canEdit && (
                    <Button onClick={() => setForm({ ...empty })}>
                        <Plus /> Operator
                    </Button>
                )}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status">
                {(['all', 'onDuty', 'planned', 'free', 'inactive'] as const).map((k) => (
                    <button
                        key={k}
                        type="button"
                        aria-pressed={filter === k}
                        onClick={() => setFilter(k)}
                        className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition',
                            filter === k
                                ? 'border-transparent bg-primary text-primary-foreground'
                                : 'bg-card hover:bg-muted',
                        )}
                    >
                        {k === 'all'
                            ? `Semua ${drivers.length}`
                            : `${DUTY_LABEL[k].label} ${counts[k]}`}
                    </button>
                ))}
            </div>

            {drivers.length === 0 ? (
                <Empty>
                    {canEdit
                        ? 'Belum ada operator. Tambahkan operator sebelum membuat penugasan shift.'
                        : 'Belum ada operator.'}
                </Empty>
            ) : shown.length === 0 ? (
                <Empty>Tidak ada operator yang cocok.</Empty>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {shown.map((d) => {
                        const job = duty.get(d.id);
                        const state: DutyState = job?.state ?? (d.active ? 'free' : 'inactive');
                        return (
                            <li
                                key={d.id}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl border bg-card p-2.5',
                                    !d.active && 'opacity-60',
                                )}
                            >
                                <Avatar name={d.name} />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <b className="truncate text-sm">{d.name}</b>
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                                DUTY_LABEL[state].tone,
                                            )}
                                        >
                                            {DUTY_LABEL[state].label}
                                        </span>
                                        {job?.mdt && (
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                                    job.mdt.category
                                                        ? DELAY_TONE[job.mdt.category]
                                                        : 'bg-muted',
                                                )}
                                            >
                                                {job.mdt.delayName ?? job.mdt.status} ·{' '}
                                                {fmtDuration(now - job.mdt.startAt)}
                                            </span>
                                        )}
                                        {d.hasPin && <Badge variant="secondary">MDT</Badge>}
                                    </span>
                                    {job?.activity && (
                                        <span className="flex min-w-0 items-center gap-1.5 text-xs">
                                            <span
                                                className={cn(
                                                    'shrink-0 rounded-md px-1.5 py-0.5 font-semibold',
                                                    ACTIVITY_TONE[job.activity.kind],
                                                )}
                                            >
                                                <MapPin className="mr-1 inline size-3" />
                                                {job.activity.label}
                                            </span>
                                            {job.activity.detail && (
                                                <span
                                                    className={cn(
                                                        'truncate',
                                                        job.activity.stale
                                                            ? 'text-warning'
                                                            : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {job.activity.detail}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                    {job && (
                                        <span className="truncate text-xs">
                                            {job.shiftName}
                                            {job.state === 'planned'
                                                ? ` (mulai ${fmtHm(job.plannedStart)})`
                                                : ''}{' '}
                                            · <b>{job.unit}</b> · {job.routeName}
                                        </span>
                                    )}
                                    <span className="truncate text-xs text-muted-foreground">
                                        {[d.employeeNo && `NIK ${d.employeeNo}`, d.phone]
                                            .filter(Boolean)
                                            .join(' · ') || '—'}
                                    </span>
                                </span>
                                {can(P.mdtManage) && (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => setPinFor(d)}
                                        aria-label={`PIN MDT ${d.name}`}
                                    >
                                        <KeyRound />
                                    </Button>
                                )}
                                {canEdit && (
                                    <span className="flex shrink-0 gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => {
                                                setEditing(d.id);
                                                setForm(formOf(d));
                                            }}
                                            aria-label={`Ubah ${d.name}`}
                                        >
                                            <Pencil />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => setToDelete(d)}
                                            aria-label={`Hapus ${d.name}`}
                                        >
                                            <Trash2 />
                                        </Button>
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <Dialog open={form != null} onOpenChange={(o) => !o && close()}>
                <DialogContent>
                    {form && (
                        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
                            <DialogHeader>
                                <DialogTitle>
                                    {editing ? 'Ubah operator' : 'Operator baru'}
                                </DialogTitle>
                                <DialogDescription>
                                    Operator tidak login ke dashboard. Datanya dipakai untuk
                                    penugasan shift, laporan, dan login MDT (NIK + PIN).
                                </DialogDescription>
                            </DialogHeader>
                            <Field label="Nama">
                                <Input
                                    value={form.name}
                                    onChange={(e) => set('name', e.target.value)}
                                    maxLength={60}
                                    required
                                    autoComplete="off"
                                    autoFocus
                                />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="NIK (no. karyawan)">
                                    <Input
                                        value={form.employeeNo}
                                        onChange={(e) => set('employeeNo', e.target.value)}
                                        maxLength={30}
                                        autoComplete="off"
                                    />
                                </Field>
                                <Field label="No. HP">
                                    <Input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => set('phone', e.target.value)}
                                        maxLength={30}
                                        autoComplete="off"
                                    />
                                </Field>
                            </div>
                            <Field
                                label="ID iButton (opsional)"
                                hint="Bila operator men-tap kunci iButton di unit."
                            >
                                <Input
                                    className="font-mono"
                                    value={form.ibutton}
                                    onChange={(e) =>
                                        set('ibutton', e.target.value.replace(/[^0-9a-f]/gi, ''))
                                    }
                                    maxLength={16}
                                    autoComplete="off"
                                />
                            </Field>
                            <Field label="Catatan">
                                <Input
                                    value={form.note}
                                    onChange={(e) => set('note', e.target.value)}
                                    maxLength={200}
                                    autoComplete="off"
                                />
                            </Field>
                            <Label className="justify-between rounded-lg border p-3">
                                <span className="flex flex-col gap-1">
                                    <span>Aktif</span>
                                    <span className="text-xs font-normal text-muted-foreground">
                                        Operator nonaktif tidak muncul di pilihan penugasan dan
                                        tidak dapat login ke MDT.
                                    </span>
                                </span>
                                <Switch
                                    checked={form.active}
                                    onCheckedChange={(v) => set('active', v)}
                                />
                            </Label>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={close}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving ? 'Menyimpan…' : 'Simpan'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={toDelete != null}
                onOpenChange={(o) => !o && setToDelete(null)}
                title={`Hapus ${toDelete?.name ?? 'operator'}?`}
                description="Bila operator ini pernah ditugaskan, datanya hanya dinonaktifkan agar laporan lama tetap utuh."
                confirmLabel="Hapus"
                destructive
                onConfirm={() => toDelete && void remove(toDelete)}
            />
            {pinFor && <PinDialog d={pinFor} onClose={() => setPinFor(null)} />}
        </div>
    );
}

// PIN 4–8 angka untuk login di tablet MDT (NIK + PIN). PIN lama langsung tidak berlaku.
function PinDialog({ d, onClose }: { d: Driver; onClose: () => void }) {
    const toast = useToast();
    const [pin, setPin] = useState('');
    const save = useMutationApiRequest<GlobalApiResponse<{ id: string }>, { pin: string }>({
        key: 'drivers-pin',
        params: { id: d.id },
        config: SILENT,
    });
    const valid = /^\d{4,8}$/.test(pin);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        try {
            await save.mutateAsync({ pin });
            toast({
                title: 'PIN MDT disimpan',
                body: `${d.name} bisa login di tablet pakai NIK ${d.employeeNo ?? '(isi NIK terlebih dahulu)'} + PIN ini.`,
            });
            onClose();
        } catch (err) {
            toast({ title: 'Gagal menyimpan PIN', body: errText(err), level: 'crit' });
        }
    };
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
                    <DialogHeader>
                        <DialogTitle>PIN MDT · {d.name}</DialogTitle>
                        <DialogDescription>
                            {d.employeeNo
                                ? `Login di tablet kabin: NIK ${d.employeeNo} + PIN.`
                                : 'Operator ini belum memiliki NIK. Isi NIK terlebih dahulu agar dapat login di MDT.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Field
                        label="PIN baru (4–8 angka)"
                        error={pin && !valid ? 'PIN harus 4–8 angka' : undefined}
                    >
                        <Input
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            inputMode="numeric"
                            autoComplete="new-password"
                            autoFocus
                            className="font-mono tracking-[0.3em]"
                        />
                    </Field>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={!valid || save.isPending}>
                            {save.isPending ? 'Menyimpan…' : 'Simpan PIN'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
