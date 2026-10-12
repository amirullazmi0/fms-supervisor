'use client';
// Shift kerja: supervisor bikin shift (pagi/sore/…) untuk satu rute, bagi driver + truk, lalu nutup shift.
// Ritase tiap driver dihitung otomatis dari GPS selama shift jalan.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Pencil, Play, Plus, RotateCcw, Square, Trash2 } from 'lucide-react';
import DriverManager from '@/components/fleet/DriverManager';
import ShiftCrew from '@/components/fleet/ShiftCrew';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import { useData, useTick } from '@/provider/StreamProvider';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import type { GlobalApiResponse } from '@/types/api/responses';
import { addDays, atTime, dateKey, fmtDate, fmtDuration, fmtHm, fmtNum, hmOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, Note, RoutePair, Stat } from '@/components/ui/misc';
import type { Route, Shift, TripRecord } from '@/types/fleet';

const STATUS: Record<Shift['status'] | 'overdue', { label: string; variant: BadgeVariant }> = {
  planned: { label: 'Rencana', variant: 'outline' },
  active: { label: 'Aktif', variant: 'success' },
  overdue: { label: 'Lewat jam', variant: 'warning' },
  closed: { label: 'Selesai', variant: 'muted' },
};
const statusOf = (s: Shift) => STATUS[s.overdue ? 'overdue' : s.status];

// Driver yang masih bertugas (penugasan belum ditutup), dihitung unik.
const onDuty = (s: Shift) => new Set(s.assignments.filter((a) => a.endAt == null).map((a) => a.driverId)).size;

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
    return { route: r, from: name(r.loadingId), to: name(r.unloadingId) };
  };
}

export default function ShiftsView() {
  const { shifts: todayShifts } = useData();
  const { setStats } = useLayout();
  const can = useCan();
  const canCreate = can(P.shiftCreate);

  const [date, setDate] = useState(() => dateKey());
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Shift tanggal yang dipilih (+ yang masih aktif dari tanggal lain). Stream 'shifts' bikin refetch.
  const listQuery = useQueryApiRequest<GlobalApiResponse<Shift[]>>({ key: 'shifts', queries: { from: date, to: date } });
  const list = listQuery.data?.data ?? [];

  // Pilih otomatis: shift aktif, kalau nggak ada yang pertama.
  useEffect(() => {
    if (selected && list.some((s) => s.id === selected)) return;
    setSelected((list.find((s) => s.status === 'active') ?? list[0])?.id ?? null);
  }, [list, selected]);

  useEffect(() => {
    const active = todayShifts.filter((s) => s.status === 'active');
    const asg = new Set(active.flatMap((s) => s.assignments.filter((a) => a.endAt == null).map((a) => a.driverId))).size;
    const overdue = active.filter((s) => s.overdue).length;
    setStats(
      <>
        <HeaderStat label="Shift aktif" value={active.length} />
        <HeaderStat label="Driver bertugas" value={asg} />
        {overdue > 0 && <HeaderStat label="Lewat jam" value={overdue} tone="danger" />}
      </>,
    );
  }, [setStats, todayShifts]);
  useEffect(() => () => setStats(null), [setStats]);

  const isToday = date === dateKey();
  const shown = list.filter((s) => s.date === date);
  const otherActive = list.filter((s) => s.date !== date && s.status === 'active');

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b bg-card p-4 lg:w-[360px] lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Daftar shift">
        <Tabs defaultValue="shifts">
          <TabsList className="w-full">
            <TabsTrigger value="shifts"><CalendarClock /> Shift</TabsTrigger>
            <TabsTrigger value="drivers">Driver</TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="pt-1">
            <DriverManager canEdit={can(P.driverCreate) || can(P.driverUpdate)} />
          </TabsContent>

          <TabsContent value="shifts" className="flex flex-col gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Hari sebelumnya"><ChevronLeft /></Button>
              <Input type="date" className="flex-1" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Tanggal" />
              <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))} aria-label="Hari berikutnya"><ChevronRight /></Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                {fmtDate(date)}
                {!isToday && <button type="button" className="ml-2 text-xs font-medium text-info hover:underline" onClick={() => setDate(dateKey())}>Hari ini</button>}
              </span>
              {canCreate && <Button size="sm" onClick={() => setCreating(true)}><Plus /> Shift</Button>}
            </div>

            {otherActive.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">Masih aktif dari tanggal lain</span>
                <ShiftList shifts={otherActive} selected={selected} onSelect={setSelected} showDate />
              </>
            )}
            {shown.length === 0 ? (
              <Empty>Belum ada shift di tanggal ini.{canCreate ? ' Tekan "+ Shift" buat bikin, mis. Pagi atau Sore.' : ''}</Empty>
            ) : (
              <ShiftList shifts={shown} selected={selected} onSelect={setSelected} />
            )}
          </TabsContent>
        </Tabs>
      </aside>

      <section className="min-w-0 flex-1 p-4 md:p-6 lg:overflow-y-auto">
        {selected ? (
          <ShiftDetail key={selected} id={selected} others={[...list, ...todayShifts]} onGone={() => setSelected(null)} />
        ) : (
          <Empty>Pilih shift di kiri, atau bikin shift baru.</Empty>
        )}
      </section>

      <ShiftForm
        open={creating}
        date={date}
        onOpenChange={setCreating}
        onSaved={(s) => {
          setCreating(false);
          setSelected(s.id);
        }}
      />
    </div>
  );
}

function ShiftList({ shifts, selected, onSelect, showDate = false }: { shifts: Shift[]; selected: string | null; onSelect: (id: string) => void; showDate?: boolean }) {
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
              className={cn('flex w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:border-ring', sel && 'border-info ring-3 ring-info/15')}
            >
              <span className="flex items-center justify-between gap-2">
                <b className="text-sm">Shift {s.name}{showDate ? ` · ${s.date}` : ''}</b>
                <Badge variant={st.variant}>{st.label}</Badge>
              </span>
              {r ? <RoutePair from={r.from} to={r.to} /> : <span className="text-xs text-muted-foreground">Belum ada rute</span>}
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-mono"><Clock className="size-3.5" /> {span(s)}</span>
                <span>{onDuty(s)} driver</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Bikin / ubah shift (dialog) ----------
function ShiftForm({ open, onOpenChange, date, shift, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; date: string; shift?: Shift; onSaved: (s: Shift) => void }) {
  const { templates, routes } = useData();
  const toast = useToast();
  const routeOf = useRouteLabel();
  const init = () => ({
    name: shift?.name ?? '',
    routeId: shift?.routeId ?? (routes.length === 1 ? routes[0].id : ''),
    date: shift?.date ?? date,
    start: shift ? hmOf(shift.plannedStart) : '06:00',
    end: shift ? hmOf(shift.plannedEnd) : '14:00',
    autoClose: shift?.autoClose ?? true,
    note: shift?.note ?? '',
  });
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  type Body = { name: string; routeId: string; plannedStart: number; plannedEnd: number; autoClose: boolean; note: string; date?: string };
  const create = useMutationApiRequest<GlobalApiResponse<Shift>, Body>({ key: 'shifts-create', config: SILENT });
  const update = useMutationApiRequest<GlobalApiResponse<Shift>, Body>({ key: 'shifts-update', params: () => ({ id: shift?.id ?? '' }), config: SILENT });
  // Form diisi ulang tiap dialog dibuka.
  useEffect(() => {
    if (open) setForm(init());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm({ ...form, [k]: v });
  const overnight = form.end <= form.start;
  const r = routeOf(form.routeId);
  const started = shift != null && shift.status !== 'planned';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const plannedStart = atTime(form.date, form.start);
      const plannedEnd = atTime(overnight ? addDays(form.date, 1) : form.date, form.end);
      const body = { name: form.name.trim(), routeId: form.routeId, plannedStart, plannedEnd, autoClose: form.autoClose, note: form.note };
      const s = (shift ? await update.mutateAsync(body) : await create.mutateAsync({ ...body, date: form.date })).data!;
      toast({ title: shift ? 'Shift diubah' : `Shift ${s.name} dibuat`, body: `${r?.route.name ?? ''} · ${span(s)}` });
      onSaved(s);
    } catch (err) {
      toast({ title: shift ? 'Gagal ngubah shift' : 'Gagal bikin shift', body: errText(err), level: 'crit' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
          <DialogHeader>
            <DialogTitle>{shift ? `Ubah shift ${shift.name}` : 'Shift baru'}</DialogTitle>
            <DialogDescription>1 shift = 1 rute. Driver & truk dibagi setelah shift dibuat.</DialogDescription>
          </DialogHeader>

          {!shift && templates.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Template shift">
              {templates.map((t) => {
                const on = form.name === t.name && form.start === t.startTime && form.end === t.endTime;
                return (
                  <Button key={t.id} type="button" size="sm" variant={on ? 'brand' : 'outline'} className="rounded-full" onClick={() => setForm({ ...form, name: t.name, start: t.startTime, end: t.endTime, autoClose: t.autoClose })}>
                    {t.name} <span className="font-mono text-xs opacity-70">{t.startTime}–{t.endTime}</span>
                  </Button>
                );
              })}
            </div>
          )}

          <Field label="Rute" hint={started ? 'Rute nggak bisa diganti setelah shift mulai.' : undefined}>
            <Combobox
              value={form.routeId}
              onChange={(v) => set('routeId', v)}
              options={routes.map((x) => ({ value: x.id, label: x.name }))}
              placeholder="Pilih rute…"
              searchPlaceholder="Cari rute…"
              empty="Belum ada rute. Bikin di menu Titik & rute."
              disabled={started}
              aria-label="Rute"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama shift"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Pagi" maxLength={40} required autoComplete="off" /></Field>
            <Field label="Tanggal kerja"><Input type="date" value={form.date} onChange={(e) => e.target.value && set('date', e.target.value)} required disabled={Boolean(shift)} /></Field>
            <Field label="Mulai"><Input type="time" value={form.start} onChange={(e) => set('start', e.target.value)} required disabled={started} /></Field>
            <Field label="Selesai"><Input type="time" value={form.end} onChange={(e) => set('end', e.target.value)} required /></Field>
          </div>
          {overnight && <Note tone="info">Jam selesai lebih kecil dari jam mulai, jadi shift selesai besoknya.</Note>}
          {form.name && r && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-[13px]">
              <b>Shift {form.name}</b> untuk rute <RoutePair from={r.from} to={r.to} />
            </div>
          )}
          <Label className="justify-between rounded-lg border p-3">
            <span className="flex flex-col gap-1">
              <span>Tutup otomatis di jam selesai</span>
              <span className="text-xs font-normal text-muted-foreground">
                {form.autoClose ? 'Shift selesai sendiri. Bisa diperpanjang sebelum itu.' : 'Shift jalan terus sampai ditutup manual. Lewat jam muncul peringatan.'}
              </span>
            </span>
            <Switch checked={form.autoClose} onCheckedChange={(v) => set('autoClose', v)} />
          </Label>
          <Field label="Catatan"><Input value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={200} autoComplete="off" /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={saving || !form.routeId}>{saving ? 'Menyimpan…' : shift ? 'Simpan' : 'Bikin shift'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Detail shift ----------
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

  const start = useMutationApiRequest<GlobalApiResponse<Shift>, void>({ key: 'shifts-start', params: { id }, config: SILENT });
  const close = useMutationApiRequest<GlobalApiResponse<Shift>, void>({ key: 'shifts-close', params: { id }, config: SILENT });
  const reopen = useMutationApiRequest<GlobalApiResponse<Shift>, void>({ key: 'shifts-reopen', params: { id }, config: SILENT });
  const update = useMutationApiRequest<GlobalApiResponse<Shift>, { plannedStart: number; plannedEnd: number }>({ key: 'shifts-update', params: { id }, config: SILENT });
  const del = useMutationApiRequest<GlobalApiResponse<{ id: string }>, void>({ key: 'shifts-delete', params: { id }, config: SILENT });
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
              {r && <RoutePair from={r.from} to={r.to} className="text-muted-foreground" />}
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              {canOperate && s.status === 'planned' && <Button onClick={() => void act('start', 'Shift dimulai')}><Play /> Mulai sekarang</Button>}
              {canUpdate && s.status === 'active' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void extend(30)}>+30 menit</Button>
                  <Button variant="outline" size="sm" onClick={() => void extend(60)}>+1 jam</Button>
                </>
              )}
              {canUpdate && s.status !== 'closed' && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil /> Ubah</Button>}
              {canOperate && s.status === 'closed' && <Button variant="outline" size="sm" onClick={() => void act('reopen', 'Shift dibuka lagi')}><RotateCcw /> Buka lagi</Button>}
              {canOperate && s.status === 'active' && <Button variant="destructive" size="sm" onClick={() => setConfirm('close')}><Square /> Selesai shift</Button>}
              {can(P.shiftDelete) && s.status === 'planned' && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirm('delete')}><Trash2 /> Hapus</Button>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
          <span>{fmtDate(s.date)}</span>
          <span>Rencana <b className="font-mono text-foreground">{span(s)}</b></span>
          {s.startedAt && <span>Mulai <b className="font-mono text-foreground">{fmtHm(s.startedAt)}</b></span>}
          {s.closedAt && <span>Selesai <b className="font-mono text-foreground">{fmtHm(s.closedAt)}</b>{s.closeReason === 'auto' ? ' (otomatis)' : ''}</span>}
          <span>{s.autoClose ? 'Tutup otomatis' : 'Tutup manual'}</span>
        </div>
        {s.note && <Empty>{s.note}</Empty>}
        {s.overdue && <Note>Shift udah lewat jam selesai ({fmtHm(s.plannedEnd)}) dan masih jalan. Tutup atau perpanjang.</Note>}
      </Card>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Ringkasan shift">
        <Stat label="Driver bertugas" value={onDuty(s)} />
        <Stat label="Ritase (berangkat)" value={done.length} sub={`${back.length} pulang${running ? ` · ${running} lagi jalan` : ''}`} />
        <Stat label="Rata-rata berangkat" value={done.length ? fmtDuration(avg) : '—'} sub={r ? `${r.from} → ${r.to}` : undefined} />
        <Stat label="Rata-rata pulang" value={back.length ? fmtDuration(backAvg) : '—'} sub={r ? `${r.to} → ${r.from}` : undefined} />
        <Stat label="BBM terpakai" value={unit ? `${fmtNum(fuelTotal, 1)} ${unit}` : '—'} />
      </section>

      <ShiftCrew shift={s} route={route} others={others} trips={trips} editable={editable} onChanged={load} />

      <ShiftForm open={editing} onOpenChange={setEditing} date={s.date} shift={s} onSaved={() => { setEditing(false); load(); }} />
      <ConfirmDialog
        open={confirm === 'close'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Selesaikan shift ${s.name}?`}
        description="Ritase yang udah berangkat sebelum ditutup tetap dihitung ke shift ini walau sampainya belakangan."
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
