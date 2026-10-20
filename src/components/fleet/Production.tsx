'use client';
// Panel produksi (P1): ritase & tonase per jam vs target dengan status sementara/final,
// kesegaran data per unit, status unit sekarang (MDT / supervisor), cycle time per tahap.
// File yang sama dipakai fms-supervisor & fms-administrator.
import { useNow } from '@/lib/useNow';
import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Clock3 } from 'lucide-react';
import { ChartCard } from '@/components/fleet/Charts';
import {
    Empty,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tip,
} from '@/components/ui/misc';
import { ago, fmtDuration, fmtHm, fmtNum } from '@/lib/format';
import { DELAY_CATEGORY, DELAY_TONE, HOUR_STATUS, SOURCE, STAGE } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type {
    Freshness,
    HourlyReport,
    HourlyRow,
    StageReport,
    StageStats,
    UnitStatusLog,
} from '@/types/fleet';

export function HourBadge({
    row,
    className,
}: {
    row: Pick<HourlyRow, 'status' | 'pending'>;
    className?: string;
}) {
    const s = HOUR_STATUS[row.status];
    const Icon =
        row.status === 'final' ? CircleCheck : row.status === 'sementara' ? CircleAlert : Clock3;
    const tip =
        row.status === 'sementara' && row.pending.length
            ? `${s.hint} Menunggu: ${row.pending.map((p) => `${p.truck} (data terakhir ${p.lastGpsAt ? fmtHm(p.lastGpsAt) : '-'})`).join(', ')}`
            : s.hint;
    return (
        <Tip label={tip}>
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    s.tone,
                    className,
                )}
            >
                <Icon className="size-3" /> {s.label}
            </span>
        </Tip>
    );
}

function pct(v: number | null): string {
    return v == null ? '-' : `${fmtNum(v, 0)}%`;
}

// Batang ton per jam; garis putus-putus = target. Jam sementara diarsir (angka masih bisa naik).
function HourlyBars({ rows, height = 220 }: { rows: HourlyRow[]; height?: number }) {
    const useTon = rows.some((r) => r.ton > 0 || r.targetTon > 0);
    const val = (r: HourlyRow) => (useTon ? r.ton : r.rit);
    const tgt = (r: HourlyRow) => (useTon ? r.targetTon : r.targetRit);
    const max = Math.max(1, ...rows.map((r) => Math.max(val(r), tgt(r)))) * 1.1;
    const every = Math.max(1, Math.ceil(rows.length / 12));
    if (rows.length === 0)
        return (
            <div
                className="grid place-items-center text-sm text-muted-foreground"
                style={{ height }}
            >
                Belum ada data.
            </div>
        );
    return (
        <div className="flex gap-2" style={{ height }}>
            <div className="flex w-12 shrink-0 flex-col justify-between pb-5 text-right text-[10.5px] text-muted-foreground tabular-nums">
                {[4, 3, 2, 1, 0].map((i) => (
                    <span key={i} className="leading-none">
                        {fmtNum((max * i) / 4)}
                    </span>
                ))}
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col">
                <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <i key={i} className="border-t border-dashed border-border" />
                    ))}
                </div>
                <div className="relative flex flex-1 items-end gap-[3px]">
                    {rows.map((r) => {
                        const v = val(r);
                        const t = tgt(r);
                        const below = t > 0 && r.status !== 'berjalan' && v < t;
                        return (
                            <Tip
                                key={r.key}
                                label={
                                    <span>
                                        <b>
                                            {r.date} {r.label}
                                        </b>{' '}
                                        · {HOUR_STATUS[r.status].label}
                                        <br />
                                        Ritase {r.rit}
                                        {r.targetRit ? ` / target ${fmtNum(r.targetRit)}` : ''} ·
                                        Tonase {fmtNum(r.ton)} t
                                        {r.targetTon ? ` / target ${fmtNum(r.targetTon)} t` : ''}
                                        <br />
                                        Pencapaian {pct(r.achievement)} · {r.units} unit
                                    </span>
                                }
                            >
                                <div className="group relative flex h-full min-w-0 flex-1 items-end">
                                    <div
                                        className={cn(
                                            'w-full rounded-t-[4px] transition-opacity group-hover:opacity-80',
                                            below ? 'bg-site-unloading' : 'bg-brand',
                                            r.status !== 'final' && 'opacity-60',
                                        )}
                                        style={{
                                            height: `${(v / max) * 100}%`,
                                            minHeight: v > 0 ? 2 : 0,
                                            backgroundImage:
                                                r.status === 'sementara'
                                                    ? 'repeating-linear-gradient(135deg, transparent 0 4px, rgb(0 0 0 / 0.18) 4px 7px)'
                                                    : undefined,
                                        }}
                                    />
                                    {t > 0 && (
                                        <i
                                            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-foreground/70"
                                            style={{ bottom: `${(t / max) * 100}%` }}
                                        />
                                    )}
                                </div>
                            </Tip>
                        );
                    })}
                </div>
                <div className="flex h-5 gap-[3px] pt-1">
                    {rows.map((r, i) => (
                        <span
                            key={r.key}
                            className="min-w-0 flex-1 truncate text-center text-[10.5px] text-muted-foreground"
                        >
                            {i % every === 0 ? r.label : ''}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function HourlyPanel({
    report,
    loading,
}: {
    report: HourlyReport | null;
    loading?: boolean;
}) {
    const rows = report?.rows ?? [];
    const total = report?.total;
    const useTon = rows.some((r) => r.ton > 0 || r.targetTon > 0);
    return (
        <ChartCard
            title={`Produksi per jam (${useTon ? 'tonase' : 'ritase'} vs target)`}
            hint={
                <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <i className="inline-block w-4 border-t-2 border-dashed border-foreground/70" />{' '}
                        target
                    </span>
                    <span className="flex items-center gap-1">
                        <i className="inline-block size-2.5 rounded-sm bg-site-dumping" /> di bawah
                        target
                    </span>
                    <span>arsir = sementara</span>
                </span>
            }
        >
            {loading && !report ? (
                <div className="h-[220px] animate-pulse rounded-lg bg-muted" />
            ) : (
                <HourlyBars rows={rows} />
            )}
            {total && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Big
                        label="Ritase"
                        value={fmtNum(total.rit)}
                        sub={total.targetRit ? `target ${fmtNum(total.targetRit)}` : undefined}
                    />
                    <Big
                        label="Tonase"
                        value={`${fmtNum(total.ton)} t`}
                        sub={total.targetTon ? `target ${fmtNum(total.targetTon)} t` : undefined}
                    />
                    <Big
                        label="Pencapaian"
                        value={pct(total.achievement)}
                        sub={total.achievement == null ? 'target belum diatur' : undefined}
                    />
                    <Big
                        label="Status data"
                        value={<HourBadge row={total} />}
                        sub={
                            total.pending.length
                                ? `${total.pending.length} unit belum kirim data`
                                : 'semua unit sudah kirim'
                        }
                    />
                </div>
            )}
            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow>
                        <TableHead>Jam</TableHead>
                        <TableHead className="text-right">Ritase</TableHead>
                        <TableHead className="text-right">Tonase</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">Capai</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                        <TableHead>Data</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...rows].reverse().map((r) => (
                        <TableRow key={r.key}>
                            <TableCell className="whitespace-nowrap font-medium">
                                {r.label}
                                <span className="ml-1 text-xs text-muted-foreground">
                                    {r.date.slice(5)}
                                </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{r.rit}</TableCell>
                            <TableCell className="text-right tabular-nums">
                                {fmtNum(r.ton)} t
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                {r.targetTon
                                    ? `${fmtNum(r.targetTon)} t`
                                    : r.targetRit
                                      ? `${fmtNum(r.targetRit)} rit`
                                      : '-'}
                            </TableCell>
                            <TableCell
                                className={cn(
                                    'text-right tabular-nums font-semibold',
                                    r.achievement != null &&
                                        r.status !== 'berjalan' &&
                                        r.achievement < 100 &&
                                        'text-warning',
                                )}
                            >
                                {pct(r.achievement)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{r.units}</TableCell>
                            <TableCell>
                                <HourBadge row={r} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ChartCard>
    );
}

function Big({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
    return (
        <div className="rounded-lg bg-muted/60 p-3">
            <p className="m-0 text-xs text-muted-foreground">{label}</p>
            <div className="text-xl font-semibold tabular-nums">{value}</div>
            {sub && <p className="m-0 text-xs text-muted-foreground">{sub}</p>}
        </div>
    );
}

// Kesegaran data: kapan data GPS terakhir & seberapa terlambat datangnya (store and forward).
export function FreshnessPanel({ list }: { list: Freshness[] }) {
    const now = useNow(60000);
    return (
        <ChartCard
            title="Kesegaran data per unit"
            hint="Keterlambatan = waktu diterima server − waktu GPS (12 jam terakhir)"
        >
            {list.length === 0 ? (
                <Empty>Belum ada unit.</Empty>
            ) : (
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Unit</TableHead>
                            <TableHead>Data GPS terakhir</TableHead>
                            <TableHead>Terakhir diterima</TableHead>
                            <TableHead className="text-right">Rata-rata keterlambatan</TableHead>
                            <TableHead className="text-right">Record terlambat</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {list.map((f) => {
                            const stale = !f.lastGpsAt || now - f.lastGpsAt > 30 * 60e3;
                            return (
                                <TableRow key={f.imei}>
                                    <TableCell className="font-medium">{f.truck}</TableCell>
                                    <TableCell className={cn(stale && 'text-warning')}>
                                        {f.lastGpsAt
                                            ? `${fmtHm(f.lastGpsAt)} · ${ago(f.lastGpsAt)}`
                                            : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {f.lastReceivedAt ? ago(f.lastReceivedAt) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {f.records ? fmtDuration(f.avgDelayMs) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {f.records
                                            ? `${fmtNum(f.lateRecords)} / ${fmtNum(f.records)}`
                                            : '-'}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </ChartCard>
    );
}

// Status unit sekarang (dari MDT operator atau input supervisor).
export function UnitStatusPanel({
    list,
    action,
}: {
    list: UnitStatusLog[];
    action?: (l: UnitStatusLog) => ReactNode;
}) {
    const now = useNow(30000);
    return (
        <ChartCard title="Status unit sekarang" hint="Dari MDT operator / input supervisor">
            {list.length === 0 ? (
                <Empty>Belum ada status dari MDT.</Empty>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {list.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                            <b className="w-24 shrink-0 truncate">{l.truck}</b>
                            <span
                                className={cn(
                                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                                    l.category ? DELAY_TONE[l.category] : 'bg-muted',
                                )}
                            >
                                {l.delayName ?? l.status}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {l.category ? DELAY_CATEGORY[l.category] : ''} ·{' '}
                                {fmtDuration(now - l.startAt)} · {SOURCE[l.source] ?? l.source}
                                {l.driverName ? ` · ${l.driverName}` : ''}
                            </span>
                            {action?.(l)}
                        </li>
                    ))}
                </ul>
            )}
        </ChartCard>
    );
}

function siteMs(s: StageStats): number {
    return s.avgQueueMs + (s.avgSpotMs ?? 0) + s.avgWorkMs;
}

// Cycle time per tahap per rute (notes 2.4).
export function StagesPanel({ report }: { report: StageReport | null }) {
    const rows = report?.rows ?? [];
    return (
        <ChartCard
            title="Cycle time per tahap"
            hint="Rata-rata ritase selesai. Spotting + muat/dumping butuh zona spot di titik."
        >
            {rows.length === 0 ? (
                <Empty>Belum ada ritase selesai di periode ini.</Empty>
            ) : (
                <div className="flex flex-col gap-5">
                    {rows.map((r) => {
                        const parts = [
                            {
                                label: STAGE.queueLoad,
                                ms: r.loading.avgQueueMs,
                                color: 'var(--warning)',
                            },
                            {
                                label: STAGE.spotLoad,
                                ms: r.loading.avgSpotMs ?? 0,
                                color: 'var(--success)',
                            },
                            {
                                label: STAGE.workLoad,
                                ms: r.loading.avgWorkMs,
                                color: 'color-mix(in oklab, var(--success) 45%, transparent)',
                            },
                            { label: STAGE.hauling, ms: r.haulingMs, color: 'var(--info)' },
                            {
                                label: STAGE.queueDump,
                                ms: r.unloading.avgQueueMs,
                                color: 'var(--warning)',
                            },
                            {
                                label: STAGE.spotDump,
                                ms: r.unloading.avgSpotMs ?? 0,
                                color: 'var(--site-unloading)',
                            },
                            {
                                label: STAGE.workDump,
                                ms: r.unloading.avgWorkMs,
                                color: 'color-mix(in oklab, var(--site-unloading) 45%, transparent)',
                            },
                            {
                                label: STAGE.returning,
                                ms: r.returningMs,
                                color: 'var(--muted-foreground)',
                            },
                        ].filter((p) => p.ms > 0);
                        const total = parts.reduce((s, p) => s + p.ms, 0) || 1;
                        // Satu bar per tahap; panjang bar relatif terhadap tahap terlama di rute ini.
                        const max = Math.max(...parts.map((p) => p.ms), 1);
                        return (
                            <div key={r.routeId}>
                                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                                    <b>{r.routeName}</b>
                                    <span className="text-muted-foreground">
                                        CT {fmtDuration(r.cycleMs)} · {fmtNum(r.ritPerHour, 2)}{' '}
                                        rit/jam · antre{' '}
                                        {fmtDuration(r.loading.avgQueueMs + r.unloading.avgQueueMs)}
                                    </span>
                                </div>
                                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                    {parts.map((p) => (
                                        <li
                                            key={p.label}
                                            className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[13rem_1fr_7rem]"
                                        >
                                            <span className="truncate text-muted-foreground">
                                                {p.label}
                                            </span>
                                            <Tip label={`${p.label}: ${fmtDuration(p.ms)}`}>
                                                <div className="h-3.5 overflow-hidden rounded-sm bg-muted">
                                                    <div
                                                        className="h-full rounded-sm"
                                                        style={{
                                                            width: `${(p.ms / max) * 100}%`,
                                                            background: p.color,
                                                        }}
                                                    />
                                                </div>
                                            </Tip>
                                            <span className="text-right tabular-nums">
                                                <b>{fmtDuration(p.ms)}</b>{' '}
                                                <span className="text-muted-foreground">
                                                    {fmtNum((p.ms / total) * 100, 0)}%
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-1.5 text-xs text-muted-foreground">
                                    Di front {fmtDuration(siteMs(r.loading))}, di dumping{' '}
                                    {fmtDuration(siteMs(r.unloading))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </ChartCard>
    );
}
