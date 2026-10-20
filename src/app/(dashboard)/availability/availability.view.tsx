'use client';
// PA & UA (P2-2): ketersediaan fisik & pemakaian unit dari log status (MDT / supervisor), per unit,
// per jenis unit, dan semua unit; total periode atau per hari / per bulan.
import { useMemo, useState } from 'react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { PageHeader } from '@/components/fleet/Page';
import { ChartCard } from '@/components/fleet/Charts';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Empty,
    Stat,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tip,
} from '@/components/ui/misc';
import { UNIT_TYPE } from '@/lib/labels';
import { addDays, dateKey, fmtDate, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GlobalApiResponse } from '@/types/api/responses';
import type {
    AvailabilityBucket,
    AvailabilityReport,
    AvailabilityRow,
    UnitType,
} from '@/types/fleet';

type Range = '7d' | '30d' | 'month' | 'custom';
type TimeKey =
    'workingMs' | 'standbyPlannedMs' | 'standbyUnplannedMs' | 'breakdownMs' | 'noStatusMs';

// Warna per kategori waktu (sama dengan legenda).
const PARTS: { key: TimeKey; label: string; color: string }[] = [
    { key: 'workingMs', label: 'Working', color: 'var(--success)' },
    { key: 'standbyPlannedMs', label: 'Standby terencana', color: 'var(--info)' },
    { key: 'standbyUnplannedMs', label: 'Standby tak terencana', color: 'var(--warning)' },
    { key: 'breakdownMs', label: 'Breakdown', color: 'var(--destructive)' },
    { key: 'noStatusMs', label: 'Tanpa status', color: 'var(--ring)' },
];

const hours = (ms: number) => `${fmtNum(ms / 3600e3, ms < 36e6 ? 1 : 0)} j`;
const pctText = (v: number | null) => (v == null ? '—' : `${fmtNum(v, 1)}%`);
const periodLabel = (p?: string) => (!p ? 'Seluruh periode' : p.length === 7 ? p : fmtDate(p));

export default function AvailabilityView() {
    const today = dateKey();
    const [range, setRange] = useState<Range>('7d');
    const [from, setFrom] = useState(addDays(today, -6));
    const [to, setTo] = useState(today);
    const [bucket, setBucket] = useState<AvailabilityBucket>('total');
    const [unitType, setUnitType] = useState('');

    const queries = useMemo(() => {
        let a = from;
        let b = to;
        if (range === '7d') [a, b] = [addDays(today, -6), today];
        if (range === '30d') [a, b] = [addDays(today, -29), today];
        if (range === 'month') [a, b] = [`${today.slice(0, 8)}01`, today];
        return {
            from: new Date(`${a}T00:00:00`).getTime(),
            to: new Date(`${b}T23:59:59.999`).getTime(),
            bucket,
            ...(unitType ? { unitType } : {}),
        };
    }, [range, from, to, today, bucket, unitType]);

    const report = useQueryApiRequest<GlobalApiResponse<AvailabilityReport>>({
        key: 'reports-availability',
        queries,
        options: { refetchInterval: 5 * 60e3 },
    });
    const rep = report.data?.data;
    // Ringkasan atas: gabungan semua periode.
    const sum = useMemo(() => combine(rep?.total ?? []), [rep]);
    const per = bucket !== 'total';

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 md:p-5">
            <PageHeader
                title="PA & UA"
                description="Physical Availability & Use of Availability dari log status unit (MDT / supervisor). Basis waktu kalender 24 jam; waktu tanpa status dihitung tersedia tetapi bukan working."
            />
            <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                    type="single"
                    value={range}
                    onValueChange={(v) => v && setRange(v as Range)}
                    aria-label="Periode"
                >
                    <ToggleGroupItem value="7d">7 hari</ToggleGroupItem>
                    <ToggleGroupItem value="30d">30 hari</ToggleGroupItem>
                    <ToggleGroupItem value="month">Bulan ini</ToggleGroupItem>
                    <ToggleGroupItem value="custom">Rentang</ToggleGroupItem>
                </ToggleGroup>
                {range === 'custom' && (
                    <>
                        <Input
                            type="date"
                            value={from}
                            max={to}
                            onChange={(e) => setFrom(e.target.value)}
                            className="w-auto"
                            aria-label="Dari tanggal"
                        />
                        <Input
                            type="date"
                            value={to}
                            min={from}
                            max={today}
                            onChange={(e) => setTo(e.target.value)}
                            className="w-auto"
                            aria-label="Sampai tanggal"
                        />
                    </>
                )}
                <ToggleGroup
                    type="single"
                    value={bucket}
                    onValueChange={(v) => v && setBucket(v as AvailabilityBucket)}
                    aria-label="Rincian"
                >
                    <ToggleGroupItem value="total">Total</ToggleGroupItem>
                    <ToggleGroupItem value="day">Per hari</ToggleGroupItem>
                    <ToggleGroupItem value="month">Per bulan</ToggleGroupItem>
                </ToggleGroup>
                <SimpleSelect
                    value={unitType}
                    onChange={(v) => setUnitType(v === 'all' ? '' : v)}
                    placeholder="Semua jenis unit"
                    aria-label="Jenis unit"
                    className="w-56"
                    options={[
                        { value: 'all', label: 'Semua jenis unit' },
                        ...(Object.keys(UNIT_TYPE) as UnitType[]).map((t) => ({
                            value: t,
                            label: UNIT_TYPE[t],
                        })),
                    ]}
                />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                    big
                    label="PA (Physical Availability)"
                    value={pctText(sum.pa)}
                    sub="(T − BD) ÷ T"
                />
                <Stat
                    big
                    label="UA (Use of Availability)"
                    value={pctText(sum.ua)}
                    sub="Working ÷ (T − BD)"
                />
                <Stat
                    big
                    label="MA (Mechanical Availability)"
                    value={pctText(sum.ma)}
                    sub="Working ÷ (Working + BD)"
                />
                <Stat
                    big
                    label="EU (Effective Utilization)"
                    value={pctText(sum.eu)}
                    sub="Working ÷ T"
                />
            </div>

            {report.isLoading ? (
                <Empty>Memuat…</Empty>
            ) : !rep || rep.units.length === 0 ? (
                <Empty>Belum ada unit pada filter ini.</Empty>
            ) : (
                <>
                    {per && (
                        <ChartCard title="Semua unit per periode" hint={<Legend />}>
                            <AvailabilityTable
                                rows={rep.total}
                                first="Periode"
                                label={(r) => periodLabel(r.period)}
                            />
                        </ChartCard>
                    )}
                    <ChartCard title="Per jenis unit" hint={per ? undefined : <Legend />}>
                        <AvailabilityTable
                            rows={rep.types}
                            first="Jenis unit"
                            label={(r) =>
                                `${UNIT_TYPE[r.unitType as UnitType] ?? r.label}${per ? ` · ${periodLabel(r.period)}` : ''}`
                            }
                        />
                    </ChartCard>
                    <ChartCard title="Per unit">
                        <AvailabilityTable
                            rows={rep.units}
                            first="Unit"
                            label={(r) => `${r.label}${per ? ` · ${periodLabel(r.period)}` : ''}`}
                        />
                    </ChartCard>
                </>
            )}
        </div>
    );
}

// Gabungkan baris (mis. semua periode) lalu hitung ulang indikatornya.
function combine(rows: AvailabilityRow[]): Pick<AvailabilityRow, 'pa' | 'ua' | 'ma' | 'eu'> {
    const t = rows.reduce((s, r) => s + r.totalMs, 0);
    const w = rows.reduce((s, r) => s + r.workingMs, 0);
    const bd = rows.reduce((s, r) => s + r.breakdownMs, 0);
    const p = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
    return { pa: p(t - bd, t), ua: p(w, t - bd), ma: p(w, w + bd), eu: p(w, t) };
}

function Legend() {
    return (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
            {PARTS.map((p) => (
                <span key={p.key} className="flex items-center gap-1">
                    <i className="size-2 rounded-sm" style={{ background: p.color }} /> {p.label}
                </span>
            ))}
        </span>
    );
}

function AvailabilityTable({
    rows,
    first,
    label,
}: {
    rows: AvailabilityRow[];
    first: string;
    label: (r: AvailabilityRow) => string;
}) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{first}</TableHead>
                    <TableHead className="min-w-48">Komposisi waktu</TableHead>
                    <TableHead className="text-right">Working</TableHead>
                    <TableHead className="text-right">Standby</TableHead>
                    <TableHead className="text-right">BD</TableHead>
                    <TableHead className="text-right">PA</TableHead>
                    <TableHead className="text-right">UA</TableHead>
                    <TableHead className="text-right">MA</TableHead>
                    <TableHead className="text-right">EU</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((r) => (
                    <TableRow key={`${r.key}|${r.period ?? ''}`}>
                        <TableCell className="font-medium">
                            {label(r)}
                            {r.units > 1 && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                    ({r.units} unit)
                                </span>
                            )}
                        </TableCell>
                        <TableCell>
                            <div className="flex h-3 overflow-hidden rounded-sm bg-muted">
                                {PARTS.map((p) =>
                                    r[p.key] > 0 ? (
                                        <Tip key={p.key} label={`${p.label}: ${hours(r[p.key])}`}>
                                            <div
                                                style={{
                                                    width: `${(r[p.key] / (r.totalMs || 1)) * 100}%`,
                                                    background: p.color,
                                                }}
                                            />
                                        </Tip>
                                    ) : null,
                                )}
                            </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {hours(r.workingMs)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {hours(r.standbyPlannedMs + r.standbyUnplannedMs)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {hours(r.breakdownMs)}
                        </TableCell>
                        <TableCell
                            className={cn('text-right font-semibold tabular-nums', low(r.pa, 85))}
                        >
                            {pctText(r.pa)}
                        </TableCell>
                        <TableCell
                            className={cn('text-right font-semibold tabular-nums', low(r.ua, 75))}
                        >
                            {pctText(r.ua)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pctText(r.ma)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pctText(r.eu)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

// Merah bila di bawah acuan umum site (PA 85%, UA 75%).
const low = (v: number | null, min: number) =>
    v != null && v < min ? 'text-destructive' : undefined;
