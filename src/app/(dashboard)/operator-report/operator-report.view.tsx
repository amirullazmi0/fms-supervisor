'use client';
// Rapor operator (P3-6) & laporan idle (P3-7): ritase, cycle time, lama dumping, idle, overspeed,
// mengemudi kasar, disiplin shift (telat mulai / berhenti lebih awal), skor 0–100; dan per unit
// lama mesin hidup tetapi diam beserta perkiraan BBM terbuang.
import { useMemo, useState } from 'react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { PageHeader } from '@/components/fleet/Page';
import { ChartCard } from '@/components/fleet/Charts';
import {
    Empty,
    Stat,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { addDays, dateKey, fmtDuration, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { OperatorReport } from '@/types/fleet';

type Range = 'today' | '7d' | '30d';

const scoreTone = (s: number) =>
    s >= 85 ? 'text-success' : s >= 70 ? 'text-warning' : 'text-destructive';

export default function OperatorReportView() {
    const [range, setRange] = useState<Range>('7d');
    const queries = useMemo(() => {
        const today = dateKey();
        const from = range === 'today' ? today : addDays(today, range === '7d' ? -6 : -29);
        return { from: new Date(`${from}T00:00:00`).getTime() };
    }, [range]);
    const report = useQueryApiRequest<GlobalApiResponse<OperatorReport>>({
        key: 'reports-operators',
        queries,
    });
    const rep = report.data?.data;
    const idleMs = rep?.idle.reduce((s, x) => s + x.idleMs, 0) ?? 0;
    const fuel = rep?.idle.reduce((s, x) => s + x.fuelL, 0) ?? 0;
    const ms = (v: number | null | undefined) => (v == null ? '—' : fmtDuration(v));

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 md:p-5">
            <PageHeader
                title="Rapor operator & idle"
                description="Skor 100 dikurangi overspeed (3/kejadian), mengemudi kasar (1), telat mulai / berhenti lebih awal > 15 mnt (5/kali), dan idle di atas 20% waktu bertugas. Idle = mesin hidup, unit diam."
            />
            <ToggleGroup
                type="single"
                value={range}
                onValueChange={(v) => v && setRange(v as Range)}
                aria-label="Periode"
                className="self-start"
            >
                <ToggleGroupItem value="today">Hari ini</ToggleGroupItem>
                <ToggleGroupItem value="7d">7 hari</ToggleGroupItem>
                <ToggleGroupItem value="30d">30 hari</ToggleGroupItem>
            </ToggleGroup>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat big label="Operator" value={rep ? String(rep.operators.length) : '—'} />
                <Stat
                    big
                    label="Rata-rata skor"
                    value={
                        rep?.operators.length
                            ? fmtNum(
                                  rep.operators.reduce((s, o) => s + o.score, 0) /
                                      rep.operators.length,
                              )
                            : '—'
                    }
                />
                <Stat big label="Total idle" value={fmtDuration(idleMs)} />
                <Stat big label="BBM terbuang (idle)" value={`${fmtNum(fuel, 1)} L`} />
            </div>

            {!rep ? (
                <Empty>Memuat…</Empty>
            ) : rep.operators.length === 0 ? (
                <Empty>Belum ada penugasan pada periode ini.</Empty>
            ) : (
                <>
                    <ChartCard title="Rapor operator">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Operator</TableHead>
                                    <TableHead className="text-right">Skor</TableHead>
                                    <TableHead className="text-right">Penugasan</TableHead>
                                    <TableHead className="text-right">Ritase</TableHead>
                                    <TableHead className="text-right">Cycle time</TableHead>
                                    <TableHead className="text-right">Dumping</TableHead>
                                    <TableHead className="text-right">Idle</TableHead>
                                    <TableHead className="text-right">Overspeed</TableHead>
                                    <TableHead className="text-right">Kasar</TableHead>
                                    <TableHead>Disiplin shift</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rep.operators.map((o) => (
                                    <TableRow key={o.driverId}>
                                        <TableCell className="font-medium">
                                            {o.driverName}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right text-base font-bold tabular-nums',
                                                scoreTone(o.score),
                                            )}
                                        >
                                            {o.score}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {o.shifts}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {o.ritase}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {ms(o.cycleMs)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {ms(o.dumpMs)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmtDuration(o.idleMs)}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right tabular-nums',
                                                o.overspeed > 0 && 'text-destructive',
                                            )}
                                        >
                                            {o.overspeed}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {o.harsh}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {o.lateStarts === 0 && o.earlyEnds === 0 ? (
                                                <span className="text-success">Tepat waktu</span>
                                            ) : (
                                                <span className="text-warning">
                                                    {o.lateStarts > 0 &&
                                                        `Telat mulai ${o.lateStarts}× (${fmtDuration(o.lateStartMs)})`}
                                                    {o.lateStarts > 0 && o.earlyEnds > 0 && ' · '}
                                                    {o.earlyEnds > 0 &&
                                                        `Berhenti awal ${o.earlyEnds}× (${fmtDuration(o.earlyEndMs)})`}
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ChartCard>
                    <ChartCard
                        title="Laporan idle per unit"
                        hint={`BBM dari CAN fuel rate; tanpa CAN dipakai perkiraan ${fmtNum(rep.idleLph, 1)} L/jam.`}
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Idle</TableHead>
                                    <TableHead className="text-right">% waktu bertugas</TableHead>
                                    <TableHead className="text-right">BBM terbuang</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rep.idle.map((x) => (
                                    <TableRow key={x.imei}>
                                        <TableCell className="font-medium">{x.unit}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmtDuration(x.idleMs)}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right tabular-nums',
                                                x.shareOfJob > 20 && 'text-warning',
                                            )}
                                        >
                                            {fmtNum(x.shareOfJob, 1)}%
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmtNum(x.fuelL, 1)} L{' '}
                                            <span className="text-xs text-muted-foreground">
                                                {x.fromCan ? 'CAN' : 'perkiraan'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ChartCard>
                </>
            )}
        </div>
    );
}
