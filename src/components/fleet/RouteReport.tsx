'use client';
// Ritase truk per rute: berangkat dari titik loading rute sampai tiba di titik unloading rute itu.
// Per ritase: durasi, jarak, berapa kali berhenti, lama berhenti, BBM.
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useStream } from '@/provider/StreamProvider';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import type { GlobalApiResponse } from '@/types/api/responses';
import { fmtDuration, fmtHm, fmtKm, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Empty, Stat } from '@/components/ui/misc';
import type { RouteReport as Report, RouteTrip } from '@/types/fleet';

interface Props {
  imei: string;
  date: string; // YYYY-MM-DD
  isToday: boolean;
  selected: number | null; // start ritase yang disorot
  onSelect: (r: { start: number; end: number } | null) => void;
}

const STATUS_TEXT: Record<RouteTrip['status'], string> = { done: 'Selesai', ongoing: 'Dalam perjalanan', unfinished: 'Belum sampai' };

export default function RouteReport({ imei, date, isToday, selected, onSelect }: Props) {
  const from = new Date(`${date}T00:00:00`).getTime();
  // Today: up to "now" (rounded to the minute so the query key stays stable between renders).
  const to = Math.min(from + 86400e3 - 1, Math.floor(Date.now() / 60000) * 60000 + 59999);
  const query = useQueryApiRequest<GlobalApiResponse<Report>>({
    key: 'devices-ritase',
    params: { imei },
    queries: { from, to },
    config: { errorNotification: false },
  });
  const report = query.data?.data ?? null;
  const loading = query.isLoading;
  const load = (_quiet: boolean) => void query.refetch();

  // Hari ini: hitung ulang waktu ada titik baru (ditunda biar nggak tiap detik). Titik diubah: hitung ulang.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useStream((msg) => {
    if (msg.type === 'sites' || (msg.type === 'point' && msg.imei === imei && isToday)) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(true), msg.type === 'sites' ? 300 : 5000);
    }
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const unit = report?.fuelUnit ?? null;
  const fuel = (v: number | null) => (v == null || !unit ? '—' : `${fmtNum(v, 1)} ${unit}`);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold">Ritase</h3>
        <Link className="text-xs font-medium text-info hover:underline" href="/sites">Atur titik &amp; rute</Link>
      </div>

      {loading && !report ? (
        <Empty>Menghitung ritase…</Empty>
      ) : !report ? (
        <Empty>Gagal memuat ritase.</Empty>
      ) : report.routes.length === 0 ? (
        <Empty>Truk ini belum dapat rute. Rute masuk lewat penugasan shift di menu <Link className="text-info hover:underline" href="/shifts">Shift</Link>.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Ritase (berangkat)" value={String(report.totals.done)} sub={`${report.totals.backDone} pulang`} big />
            <Stat label="Rata-rata berangkat" value={report.totals.done ? fmtDuration(report.totals.avgDurationMs) : '—'} sub={report.totals.backDone ? `pulang ${fmtDuration(report.totals.backAvgMs)}` : undefined} big />
            <Stat label="Jarak" value={fmtKm(report.totals.distance)} unit="km" />
            <Stat label="Berhenti" value={`${report.totals.stops}×`} sub={fmtDuration(report.totals.stoppedMs)} />
            <Stat label="BBM total" value={fuel(report.totals.fuelUsed)} />
            <Stat label="Kunjungan titik" value={String(report.visits.length)} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {report.routes.map((r) => <Badge key={r.id} variant="outline">{r.name}</Badge>)}
          </div>
          {report.trips.length === 0 ? (
            <Empty>Belum ada ritase di tanggal ini. Ritase kehitung setelah truk keluar dari titik loading rute lalu masuk ke titik unloading rute yang sama.</Empty>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {[...report.trips].reverse().map((r) => {
                const on = selected === r.start;
                return (
                  <li key={r.start}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => onSelect(on ? null : { start: r.start, end: r.end })}
                      className={cn('flex w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:border-ring', on && 'border-info ring-3 ring-info/20')}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge variant={r.leg === 'go' ? 'brand' : 'secondary'}>{r.leg === 'go' ? 'Berangkat' : 'Pulang'}</Badge>
                          <span className="truncate text-[13px] font-medium">{r.loading.name} → {r.unloading?.name ?? '…'}</span>
                        </span>
                        {r.status !== 'done' && <Badge variant={r.status === 'ongoing' ? 'info' : 'warning'}>{STATUS_TEXT[r.status]}</Badge>}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {fmtHm(r.start)}–{r.unloading ? fmtHm(r.end) : 'sekarang'} · <b className="text-foreground">{fmtDuration(r.durationMs)}</b>
                      </span>
                      <span className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[12.5px]">
                        <Mini label="Jarak" value={`${fmtKm(r.distance)} km`} />
                        <Mini label="Berhenti" value={`${r.stops}× · ${fmtDuration(r.stoppedMs)}`} />
                        <Mini label="BBM" value={fuel(r.fuelUsed)} />
                        <Mini label="Rata-rata" value={`${fmtNum(r.avgSpeed)} km/jam`} />
                        <Mini label={`Di ${r.loading.name}`} value={fmtDuration(r.loading.dwellMs)} />
                        <Mini label={`Di ${r.unloading?.name ?? 'tujuan'}`} value={r.unloading ? fmtDuration(r.unloading.dwellMs) : '—'} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <small className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</small>
      <span className="truncate">{value}</span>
    </span>
  );
}
