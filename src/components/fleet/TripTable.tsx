'use client';
// Tabel ritase tersimpan: berangkat dari pit, tiba di stockpile / jetty, durasi, berhenti, BBM.
// Di HP tabel bergeser horizontal, kolom pertama tetap menempel.
import { fmtDuration, fmtHm, fmtKm, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Empty,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import type { TripRecord } from '@/types/fleet';

type Col = 'date' | 'shift' | 'driver' | 'truck' | 'route';

interface Props {
    trips: TripRecord[];
    show?: Col[]; // kolom tambahan di depan
    empty?: string;
}

const fuel = (v: number | null, unit: string | null) =>
    v == null || !unit ? '—' : `${fmtNum(v, 1)} ${unit}`;
const dayLabel = (ms: number) =>
    new Date(ms).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
const sticky = 'sticky left-0 z-[1] bg-card';

export default function TripTable({ trips, show = [], empty = 'Belum ada ritase.' }: Props) {
    if (!trips.length) return <Empty>{empty}</Empty>;
    const has = (c: Col) => show.includes(c);
    const first = (show.length ? show[0] : 'depart') as Col | 'depart';
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {has('date') && (
                        <TableHead className={cn(first === 'date' && sticky)}>Tanggal</TableHead>
                    )}
                    {has('shift') && (
                        <TableHead className={cn(first === 'shift' && sticky)}>Shift</TableHead>
                    )}
                    {has('driver') && (
                        <TableHead className={cn(first === 'driver' && sticky)}>Operator</TableHead>
                    )}
                    {has('truck') && (
                        <TableHead className={cn(first === 'truck' && sticky)}>Unit</TableHead>
                    )}
                    {has('route') && (
                        <TableHead className={cn(first === 'route' && sticky)}>Rute</TableHead>
                    )}
                    <TableHead>Arah</TableHead>
                    <TableHead className={cn(first === 'depart' && sticky)}>Hauling</TableHead>
                    <TableHead>Sampai</TableHead>
                    <TableHead className="text-right">Durasi</TableHead>
                    <TableHead className="text-right">Jarak</TableHead>
                    <TableHead className="text-right">Berhenti</TableHead>
                    <TableHead className="text-right">BBM awal</TableHead>
                    <TableHead className="text-right">BBM akhir</TableHead>
                    <TableHead className="text-right">BBM terpakai</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {trips.map((t) => (
                    <TableRow
                        key={t.id}
                        className={cn(t.status !== 'done' && 'text-muted-foreground')}
                    >
                        {has('date') && (
                            <TableCell className={cn('font-mono', first === 'date' && sticky)}>
                                {dayLabel(t.departAt)}
                            </TableCell>
                        )}
                        {has('shift') && (
                            <TableCell className={cn(first === 'shift' && sticky)}>
                                {t.shiftName ?? '—'}
                            </TableCell>
                        )}
                        {has('driver') && (
                            <TableCell className={cn('font-medium', first === 'driver' && sticky)}>
                                {t.driverName ?? '—'}
                            </TableCell>
                        )}
                        {has('truck') && (
                            <TableCell className={cn('font-mono', first === 'truck' && sticky)}>
                                {t.truck ?? t.imei}
                            </TableCell>
                        )}
                        {has('route') && (
                            <TableCell className={cn(first === 'route' && sticky)}>
                                {t.routeName}
                            </TableCell>
                        )}
                        <TableCell>
                            <span className="flex items-center gap-2">
                                <Badge variant={t.leg === 'go' ? 'brand' : 'secondary'}>
                                    {t.leg === 'go' ? 'Hauling' : 'Return'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {t.loadingName} → {t.unloadingName}
                                </span>
                            </span>
                        </TableCell>
                        <TableCell className={cn('font-mono', first === 'depart' && sticky)}>
                            {fmtHm(t.departAt)}
                        </TableCell>
                        <TableCell className="font-mono">
                            {t.arriveAt ? fmtHm(t.arriveAt) : <Badge variant="info">Jalan</Badge>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {fmtDuration(t.durationMs)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {fmtKm(t.distance)} km
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {t.stops}×{t.stops ? ` · ${fmtDuration(t.stoppedMs)}` : ''}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {fuel(t.fuelAtLoading, t.fuelUnit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {fuel(t.fuelAtUnloading, t.fuelUnit)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                            {fuel(t.fuelUsed, t.fuelUnit)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
