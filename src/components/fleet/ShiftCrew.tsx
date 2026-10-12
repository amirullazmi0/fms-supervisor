'use client';
// Kru satu shift: driver + truk yang jalan di rute shift ini.
//   - "Tugaskan driver": pilih driver (bisa dicari), truk keisi otomatis (truk terakhir driver itu).
//   - Driver/truk yang lagi ada di shift lain yang jamnya bentrok nggak bisa dipilih.
//   - Penugasan yang udah selesai (ganti truk / selesai tugas) tetap tampil pudar sebagai riwayat.
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronDown, Copy, Plus, Truck, UserPlus, X } from 'lucide-react';
import TripTable from '@/components/fleet/TripTable';
import { useToast } from '@/components/fleet/Toasts';
import { useData } from '@/provider/StreamProvider';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { errText } from '@/lib/api-error';
import type { GlobalApiResponse } from '@/types/api/responses';
import { fmtDuration, fmtHm, fmtNum, truckLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import type { ComboOption } from '@/components/ui/combobox';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Avatar, Empty, Note } from '@/components/ui/misc';
import type { Assignment, Device, Driver, Route, Shift, TripRecord } from '@/types/fleet';

type Last = Record<string, { imei: string; routeId: string }>;

interface Props {
  shift: Shift;
  route: Route | undefined;
  others: Shift[]; // shift lain (buat ngecek driver/truk yang lagi dipakai)
  trips: TripRecord[];
  editable: boolean;
  onChanged: () => void;
}

// Jam kerja efektif sebuah shift (yang aktif bisa molor lewat jam selesai).
function span(s: Shift, now: number): [number, number] {
  const start = s.startedAt ?? s.plannedStart;
  const end = s.status === 'closed' ? s.closedAt ?? s.plannedEnd : s.status === 'active' ? Math.max(s.plannedEnd, now) : s.plannedEnd;
  return [start, end];
}

// Driver & truk yang dipakai shift lain yang jamnya bentrok: id -> "Sore · Rute B".
function busyElsewhere(shift: Shift, others: Shift[], routes: Route[]) {
  const now = Date.now();
  const [a0, a1] = span(shift, now);
  const drivers = new Map<string, string>();
  const trucks = new Map<string, string>();
  for (const o of others) {
    if (o.id === shift.id || o.status === 'closed') continue;
    const [b0, b1] = span(o, now);
    if (!(b0 < a1 && b1 > a0)) continue;
    const label = `${o.name}${o.routeId ? ` · ${routes.find((r) => r.id === o.routeId)?.name ?? ''}` : ''}`;
    for (const x of o.assignments) {
      if (x.endAt != null) continue;
      drivers.set(x.driverId, label);
      trucks.set(x.imei, label);
    }
  }
  return { drivers, trucks };
}

type Busy = ReturnType<typeof busyElsewhere>;

export default function ShiftCrew({ shift, route, others, trips, editable, onChanged }: Props) {
  const { drivers, devices, routes } = useData();
  const toast = useToast();
  const lastQuery = useQueryApiRequest<GlobalApiResponse<Last>>({ key: 'drivers-last', config: { errorNotification: false } });
  const last: Last = lastQuery.data?.data ?? {};
  const copy = useMutationApiRequest<GlobalApiResponse<{ from: string; added: number; skipped: string[] }>, void>({
    key: 'shifts-copy-previous',
    params: { id: shift.id },
    config: SILENT,
  });
  const [adding, setAdding] = useState<string | null>(null); // null = form tertutup, '' = kosong, id = driver dari daftar "belum dapat tugas"
  const [expanded, setExpanded] = useState<string | null>(null);

  const trucks = useMemo(() => Object.values(devices).sort((a, b) => truckLabel(a).localeCompare(truckLabel(b))), [devices]);
  const open = shift.assignments.filter((a) => a.endAt == null);
  const list = [...open, ...shift.assignments.filter((a) => a.endAt != null)];
  const busy = busyElsewhere(shift, others, routes);
  const usedDrivers = new Set(open.map((a) => a.driverId));
  const usedTrucks = new Set(open.map((a) => a.imei));
  const freeDrivers = drivers.filter((d) => d.active && !usedDrivers.has(d.id) && !busy.drivers.has(d.id));
  const freeTrucks = trucks.filter((t) => !usedTrucks.has(t.imei) && !busy.trucks.has(t.imei));
  const unit = trips.find((t) => t.fuelUnit)?.fuelUnit ?? null;

  if (!route) return <Note>Shift ini belum punya rute. Ubah shift dan pilih rutenya dulu.</Note>;

  const copyPrevious = async () => {
    try {
      const r = (await copy.mutateAsync()).data!;
      toast({ title: `${r.added} driver disalin dari ${r.from}`, body: r.skipped.length ? `${r.skipped.length} dilewati: ${r.skipped[0]}` : undefined, level: r.skipped.length ? 'warn' : 'info' });
      onChanged();
    } catch (err) {
      toast({ title: 'Gagal nyalin', body: errText(err), level: 'crit' });
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Driver di shift ini">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[15px] font-semibold">
          Driver &amp; truk <span className="font-normal text-muted-foreground">· {open.length} bertugas</span>
        </h3>
        {editable && shift.assignments.length === 0 && (
          <Button variant="outline" size="sm" onClick={() => void copyPrevious()}><Copy /> Salin dari shift sebelumnya</Button>
        )}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <ul className="m-0 list-none divide-y p-0">
          {list.map((a) => (
            <AssignmentItem
              key={a.id}
              a={a}
              driver={drivers.find((d) => d.id === a.driverId)}
              truck={devices[a.imei]}
              trips={trips.filter((t) => t.assignmentId === a.id)}
              unit={unit}
              editable={editable}
              open={expanded === a.id}
              onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
              freeTrucks={freeTrucks}
              status={shift.status}
              shiftStart={shift.startedAt}
              onChanged={onChanged}
            />
          ))}
          {list.length === 0 && <li className="px-4 py-5"><Empty>Belum ada driver di shift ini.</Empty></li>}
        </ul>

        {editable && (adding != null ? (
          <AddForm
            key={adding}
            shift={shift}
            freeDrivers={freeDrivers}
            freeTrucks={freeTrucks}
            busy={busy}
            allDrivers={drivers.filter((d) => d.active && !usedDrivers.has(d.id))}
            allTrucks={trucks.filter((t) => !usedTrucks.has(t.imei))}
            last={last}
            initialDriver={adding || undefined}
            onDone={onChanged}
            onClose={() => setAdding(null)}
          />
        ) : (
          <div className="border-t p-3">
            <Button variant="outline" className="w-full border-dashed" onClick={() => setAdding('')} disabled={!freeDrivers.length}>
              <UserPlus /> {freeDrivers.length ? 'Tugaskan driver' : drivers.length ? 'Semua driver aktif udah dapat tugas' : 'Belum ada driver. Tambah di tab Driver.'}
            </Button>
          </div>
        ))}
      </Card>

      {editable && (freeDrivers.length > 0 || freeTrucks.length > 0) && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-card p-3.5" aria-label="Belum dapat tugas">
          {freeDrivers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Driver belum dapat tugas</span>
              <div className="flex flex-wrap gap-1.5">
                {freeDrivers.map((d) => (
                  <Button key={d.id} variant="secondary" size="sm" className="rounded-full" onClick={() => setAdding(d.id)}><Plus /> {d.name}</Button>
                ))}
              </div>
            </div>
          )}
          {freeTrucks.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Truk nganggur</span>
              <div className="flex flex-wrap gap-1.5">
                {freeTrucks.map((t) => <Badge key={t.imei} variant="outline" className="font-mono font-medium"><Truck /> {truckLabel(t)}</Badge>)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------- Tambah driver ----------
interface AddProps {
  shift: Shift;
  freeDrivers: Driver[];
  freeTrucks: Device[];
  allDrivers: Driver[]; // termasuk yang lagi di shift lain (ditampilin tapi dimatiin)
  allTrucks: Device[];
  busy: Busy;
  last: Last;
  initialDriver?: string;
  onDone: () => void;
  onClose: () => void;
}

function AddForm({ shift, freeDrivers, freeTrucks, allDrivers, allTrucks, busy, last, initialDriver, onDone, onClose }: AddProps) {
  const toast = useToast();
  const suggest = (driverId: string) => {
    const imei = last[driverId]?.imei;
    return imei && freeTrucks.some((t) => t.imei === imei) ? imei : '';
  };
  const [driverId, setDriverId] = useState(initialDriver ?? '');
  const [imei, setImei] = useState(() => (initialDriver ? suggest(initialDriver) : ''));
  const [saving, setSaving] = useState(false);
  const assign = useMutationApiRequest<GlobalApiResponse<Assignment>, { driverId: string; imei: string }>({
    key: 'shifts-assign',
    params: { id: shift.id },
    config: SILENT,
  });

  const pickDriver = (id: string) => {
    setDriverId(id);
    const s = suggest(id);
    if (s) setImei(s);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await assign.mutateAsync({ driverId, imei });
      const d = freeDrivers.find((x) => x.id === driverId);
      toast({ title: `${d?.name ?? 'Driver'} ditugaskan` });
      setDriverId('');
      setImei('');
      onDone();
      if (freeDrivers.length <= 1) onClose();
    } catch (err) {
      toast({ title: 'Gagal nugasin', body: errText(err), level: 'crit' });
    } finally {
      setSaving(false);
    }
  };

  const driverOptions: ComboOption[] = allDrivers.map((d) => ({
    value: d.id,
    label: d.name,
    hint: busy.drivers.get(d.id) ? `di ${busy.drivers.get(d.id)}` : d.employeeNo ?? undefined,
    keywords: [d.employeeNo ?? '', d.phone ?? ''],
    disabled: busy.drivers.has(d.id),
  }));
  const truckOptions: ComboOption[] = allTrucks.map((t) => ({
    value: t.imei,
    label: truckLabel(t),
    hint: busy.trucks.get(t.imei) ? `di ${busy.trucks.get(t.imei)}` : last[driverId]?.imei === t.imei ? 'terakhir dibawa' : t.vehicle ?? undefined,
    keywords: [t.name ?? '', t.vehicle ?? '', t.imei],
    disabled: busy.trucks.has(t.imei),
  }));

  return (
    <form className="flex flex-col gap-3 border-t bg-brand-soft/40 p-3 sm:flex-row sm:items-center" onSubmit={(e) => void save(e)}>
      <Combobox className="sm:flex-1" value={driverId} onChange={pickDriver} options={driverOptions} placeholder="Pilih driver…" searchPlaceholder="Cari nama / no. karyawan…" aria-label="Driver" />
      <Combobox className="sm:flex-1" value={imei} onChange={setImei} options={truckOptions} placeholder="Pilih truk…" searchPlaceholder="Cari plat / jenis…" aria-label="Truk" icon={<Truck className="size-4 text-muted-foreground" />} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 sm:flex-none" disabled={saving || !driverId || !imei}>{saving ? 'Menyimpan…' : 'Tugaskan'}</Button>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup form"><X /></Button>
      </div>
      {freeTrucks.length === 0 && <Empty className="text-xs sm:basis-full">Semua truk lagi dipakai.</Empty>}
    </form>
  );
}

// ---------- Satu driver ----------
interface ItemProps {
  a: Assignment;
  driver: Driver | undefined;
  truck: Device | undefined;
  trips: TripRecord[];
  unit: string | null;
  editable: boolean;
  open: boolean;
  onToggle: () => void;
  freeTrucks: Device[];
  status: Shift['status'];
  shiftStart: number | null;
  onChanged: () => void;
}

function AssignmentItem({ a, driver, truck, trips, unit, editable, open, onToggle, freeTrucks, status, shiftStart, onChanged }: ItemProps) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const ended = a.endAt != null;
  // Jam berlaku: tampil kalau penugasan nggak penuh satu shift.
  const when = ended ? `${fmtHm(a.startAt ?? shiftStart ?? a.createdAt)}–${fmtHm(a.endAt!)}` : a.startAt ? `mulai ${fmtHm(a.startAt)}` : null;
  const done = trips.filter((t) => t.leg === 'go' && t.status === 'done');
  const back = trips.filter((t) => t.leg === 'back' && t.status === 'done');
  const fuel = trips.reduce((n, t) => n + (t.fuelUsed ?? 0), 0);
  const going = trips.some((t) => t.status !== 'done');
  const avgOf = (xs: TripRecord[]) => (xs.length ? fmtDuration(xs.reduce((n, t) => n + t.durationMs, 0) / xs.length) : '—');
  const ending = status === 'active' && trips.length > 0;
  const update = useMutationApiRequest<GlobalApiResponse<Assignment>, { driverId: string; imei: string; note: string | null }>({
    key: 'assignments-update',
    params: { id: a.id },
    config: SILENT,
  });
  const del = useMutationApiRequest<GlobalApiResponse<{ result: 'deleted' | 'ended' }>, void>({
    key: 'assignments-delete',
    params: { id: a.id },
    config: SILENT,
  });

  const changeTruck = async (imei: string) => {
    try {
      await update.mutateAsync({ driverId: a.driverId, imei, note: a.note });
      toast({ title: 'Truk diganti', body: status === 'active' ? 'Ritase sebelumnya tetap kecatat di truk lama.' : undefined });
      onChanged();
    } catch (err) {
      toast({ title: 'Gagal', body: errText(err), level: 'crit' });
    }
  };
  const remove = async () => {
    try {
      const r = (await del.mutateAsync()).data!;
      toast({
        title: r.result === 'ended' ? `${driver?.name ?? 'Driver'} selesai tugas` : `${driver?.name ?? 'Driver'} dilepas dari shift`,
        body: r.result === 'ended' ? 'Ritase yang udah dijalanin tetap kecatat.' : undefined,
        level: 'warn',
      });
      onChanged();
    } catch (err) {
      toast({ title: 'Gagal', body: errText(err), level: 'crit' });
    }
  };

  return (
    <li className={cn(open && 'bg-muted/40')}>
      <div className="flex flex-wrap items-center gap-2 pr-3">
        <button type="button" className={cn('flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left', ended && 'opacity-55')} aria-expanded={open} onClick={onToggle}>
          <Avatar name={driver?.name ?? '?'} className={cn(ended && 'bg-muted text-muted-foreground')} />
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-sm">{driver?.name ?? 'Driver dihapus'}</b>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {truck ? truckLabel(truck) : a.imei}
              {when && <span className="font-sans"> · {when}</span>}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="flex items-center gap-1.5 text-sm">
              <b className="tabular-nums">{done.length}</b>
              <span className="text-xs text-muted-foreground">ritase · {back.length} pulang</span>
              {going && <Badge variant="info">jalan</Badge>}
            </span>
            {unit && trips.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{fmtNum(fuel, 1)} {unit}</span>}
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {editable && !ended && (
          <div className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:px-4 max-sm:pb-3">
            <Combobox
              size="sm"
              className="w-40 max-sm:flex-1"
              value=""
              onChange={(v) => void changeTruck(v)}
              options={freeTrucks.map((t) => ({ value: t.imei, label: truckLabel(t), hint: t.vehicle ?? undefined }))}
              placeholder="Ganti truk…"
              searchPlaceholder="Cari plat…"
              empty="Nggak ada truk yang nganggur."
              aria-label="Ganti truk"
            />
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirm(true)} aria-label={`Lepas ${driver?.name ?? 'driver'} dari shift`}>
              <X />
            </Button>
          </div>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {(done.length > 0 || back.length > 0) && <Empty className="text-xs">Rata-rata berangkat {avgOf(done)} · pulang {avgOf(back)}.</Empty>}
          <div className="rounded-lg border bg-card">
            <TripTable trips={[...trips].reverse()} empty={status === 'planned' ? 'Shift belum mulai.' : 'Belum ada ritase. Kehitung setelah truk keluar dari titik loading lalu sampai di unloading.'} />
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={ending ? `Selesaikan tugas ${driver?.name ?? 'driver'}?` : `Lepas ${driver?.name ?? 'driver'} dari shift?`}
        description={ending ? 'Ritase yang udah dijalanin tetap kecatat. Driver & truknya bisa ditugaskan lagi.' : 'Penugasan ini dihapus dari shift.'}
        confirmLabel={ending ? 'Selesai tugas' : 'Lepas'}
        destructive
        onConfirm={() => void remove()}
      />
    </li>
  );
}
