'use client';
// Breakdown & kesehatan mesin (P3-5): log breakdown dengan durasi perbaikan (MTTR) per unit dan
// per jenis BD, unit yang masih breakdown, dan alert mesin dari CAN (suhu mesin, kode error DTC).
import { useMemo, useState } from 'react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { PageHeader } from '@/components/fleet/Page';
import { ChartCard } from '@/components/fleet/Charts';
import { useData } from '@/provider/StreamProvider';
import { Badge } from '@/components/ui/badge';
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
import { addDays, dateKey, displayName, fmtDateTime, fmtDuration } from '@/lib/format';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { BreakdownReport } from '@/types/fleet';

type Range = '7d' | '30d' | '90d';
const ENGINE_KINDS = new Set(['engine_temp', 'engine_dtc']);

export default function BreakdownsView() {
    const { events, devices } = useData();
    const [range, setRange] = useState<Range>('30d');
    const queries = useMemo(() => {
        const days = range === '7d' ? 6 : range === '30d' ? 29 : 89;
        return { from: new Date(`${addDays(dateKey(), -days)}T00:00:00`).getTime() };
    }, [range]);
    const report = useQueryApiRequest<GlobalApiResponse<BreakdownReport>>({
        key: 'reports-breakdowns',
        queries,
        options: { refetchInterval: 60000 },
    });
    const rep = report.data?.data;
    const engine = events
        .filter((e) => ENGINE_KINDS.has(e.kind))
        .slice(-50)
        .reverse();
    const ms = (v: number | null | undefined) => (v == null ? '—' : fmtDuration(v));

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 md:p-5">
            <PageHeader
                title="Breakdown & mesin"
                description="Durasi perbaikan dari status Breakdown (MDT / supervisor). BD beruntun tanpa kembali working dihitung satu perbaikan. MTTR = rata-rata durasi perbaikan yang sudah selesai."
            />
            <ToggleGroup
                type="single"
                value={range}
                onValueChange={(v) => v && setRange(v as Range)}
                aria-label="Periode"
                className="self-start"
            >
                <ToggleGroupItem value="7d">7 hari</ToggleGroupItem>
                <ToggleGroupItem value="30d">30 hari</ToggleGroupItem>
                <ToggleGroupItem value="90d">90 hari</ToggleGroupItem>
            </ToggleGroup>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat big label="MTTR semua unit" value={ms(rep?.mttrMs)} />
                <Stat
                    big
                    label="Kejadian breakdown"
                    value={rep ? String(rep.episodes.length) : '—'}
                />
                <Stat
                    big
                    label="Unit masih breakdown"
                    value={rep ? String(rep.open) : '—'}
                    className={rep?.open ? 'border-destructive' : undefined}
                />
                <Stat big label="Alert mesin (sesi ini)" value={String(engine.length)} />
            </div>

            {!rep ? (
                <Empty>Memuat…</Empty>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    <ChartCard title="Per unit">
                        {rep.units.length === 0 ? (
                            <Empty>Tidak ada breakdown pada periode ini.</Empty>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Unit</TableHead>
                                        <TableHead className="text-right">Kejadian</TableHead>
                                        <TableHead className="text-right">Total BD</TableHead>
                                        <TableHead className="text-right">MTTR</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rep.units.map((u) => (
                                        <TableRow key={u.imei}>
                                            <TableCell className="font-medium">
                                                {u.unit}{' '}
                                                {u.openNow && (
                                                    <Badge variant="destructive">BD sekarang</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {u.count}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {fmtDuration(u.totalMs)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {ms(u.mttrMs)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </ChartCard>
                    <ChartCard title="Per jenis breakdown">
                        {rep.codes.length === 0 ? (
                            <Empty>Tidak ada breakdown pada periode ini.</Empty>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Jenis</TableHead>
                                        <TableHead className="text-right">Kejadian</TableHead>
                                        <TableHead className="text-right">Total BD</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rep.codes.map((c) => (
                                        <TableRow key={c.name}>
                                            <TableCell className="font-medium">{c.name}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {c.count}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {fmtDuration(c.totalMs)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </ChartCard>
                    <ChartCard title="Log breakdown" className="lg:col-span-2">
                        {rep.episodes.length === 0 ? (
                            <Empty>Tidak ada breakdown pada periode ini.</Empty>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mulai</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead>Jenis</TableHead>
                                        <TableHead>Operator</TableHead>
                                        <TableHead>Selesai</TableHead>
                                        <TableHead className="text-right">
                                            Durasi perbaikan
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rep.episodes.slice(0, 300).map((e) => (
                                        <TableRow key={`${e.imei}|${e.startAt}`}>
                                            <TableCell>{fmtDateTime(e.startAt)}</TableCell>
                                            <TableCell className="font-medium">{e.unit}</TableCell>
                                            <TableCell>
                                                {e.codes.join(' → ')}
                                                {e.note && (
                                                    <span className="block text-xs text-muted-foreground">
                                                        {e.note}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>{e.driverName ?? '—'}</TableCell>
                                            <TableCell>
                                                {e.endAt ? (
                                                    fmtDateTime(e.endAt)
                                                ) : (
                                                    <Badge variant="destructive">
                                                        Masih breakdown
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {fmtDuration(e.durationMs)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </ChartCard>
                </div>
            )}

            <ChartCard
                title="Alert mesin dari CAN"
                hint="Suhu mesin ≥ 100 °C (≥ 105 °C kritis) dan kode error DTC. Butuh CAN terpasang."
            >
                {engine.length === 0 ? (
                    <Empty>
                        Belum ada alert mesin. Data CAN muncul setelah FMC150 tersambung ke CAN
                        unit.
                    </Empty>
                ) : (
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                        {engine.map((e) => (
                            <li
                                key={`${e.imei}|${e.time}|${e.kind}`}
                                className="flex flex-wrap gap-x-2"
                            >
                                <Badge variant={e.level === 'crit' ? 'destructive' : 'warning'}>
                                    {e.level === 'crit' ? 'Kritis' : 'Peringatan'}
                                </Badge>
                                <b>{devices[e.imei] ? displayName(devices[e.imei]) : e.imei}</b>
                                <span>{e.text}</span>
                                <span className="text-muted-foreground">{fmtDateTime(e.time)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </ChartCard>
        </div>
    );
}
