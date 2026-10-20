'use client';
// Detail satu unit (dipakai Live & Armada): kondisi, CAN, riwayat kecepatan/aki, event,
// kirim perintah GPRS, dan tabel semua IO terakhir.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Radio } from 'lucide-react';
import LineChart from '@/components/fleet/LineChart';
import UnitStatusTimeline from '@/components/fleet/UnitStatusTimeline';
import EventList from '@/components/fleet/EventList';
import { CommandBox, Terminal } from '@/components/fleet/Terminal';
import type { TermLine } from '@/components/fleet/Terminal';
import { useToast } from '@/components/fleet/Toasts';
import { useData, useStream } from '@/provider/StreamProvider';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import type { GlobalApiResponse } from '@/types/api/responses';
import { ago, displayName, fmtDateTime, fmtIo, fmtNum, fmtTime, num, statusOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Empty,
    Note,
    StatusBadge,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tip,
} from '@/components/ui/misc';
import type { Device, HistoryPoint, IoValue } from '@/types/fleet';

const QUICK = ['getstatus', 'getver', 'getgps', 'getinfo'];
export const RANGES = [
    { min: '15', label: '15 mnt' },
    { min: '60', label: '1 jam' },
    { min: '360', label: '6 jam' },
    { min: '0', label: 'Semua' },
];

// Riwayat titik satu alat (diambil sekali, titik baru dari stream ditambahkan), dipotong ke rentang menit.
export function useDeviceHistory(imei: string | null, rangeMin: string): HistoryPoint[] {
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const detail = useQueryApiRequest<GlobalApiResponse<Device & { history: HistoryPoint[] }>>({
        key: 'devices-by-imei',
        params: { imei: imei ?? '' },
        queries: { limit: 3000 },
        config: { errorNotification: false },
        options: { enabled: Boolean(imei), staleTime: 0, refetchOnMount: 'always' },
    });
    useEffect(() => {
        setHistory(detail.data?.data?.history ?? []);
    }, [detail.data, imei]);
    useStream((msg) => {
        if (msg.type !== 'point' || msg.imei !== imei) return;
        setHistory((h) => {
            const p = msg.point;
            // Record tumpukan (dikirim terlambat setelah sinyal kembali) disisipkan sesuai waktunya.
            if (h.length === 0 || p.t >= h[h.length - 1].t) return [...h.slice(-2999), p];
            const i = h.findIndex((x) => x.t > p.t);
            return [...h.slice(0, i), p, ...h.slice(i)].slice(-3000);
        });
    });
    return useMemo(() => {
        const min = Number(rangeMin);
        if (!min) return history;
        const from = Date.now() - min * 60e3;
        return history.filter((p) => p.t >= from);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, rangeMin]);
}

export interface DetailProps {
    d: Device;
    io: ReturnType<typeof useData>['io'];
    groups: ReturnType<typeof useData>['groups'];
    history: HistoryPoint[];
    rangeMin: string;
    onRange: (min: string) => void;
    events: ReturnType<typeof useData>['events'];
    devices: Record<string, Device>;
    cmdLines: ReturnType<typeof useData>['cmdLog'];
}

export default function DeviceDetail({
    d,
    io,
    groups,
    history,
    rangeMin,
    onRange,
    events,
    devices,
    cmdLines,
}: DetailProps) {
    const toast = useToast();
    const [errors, setErrors] = useState<TermLine[]>([]);
    const can = useCan();
    const rename = useMutationApiRequest<GlobalApiResponse<Device>, { name: string }>({
        key: 'devices-update',
        params: { imei: d.imei },
        config: SILENT,
    });
    const command = useMutationApiRequest<GlobalApiResponse<{ response: string }>, { cmd: string }>(
        { key: 'devices-command', params: { imei: d.imei }, config: SILENT },
    );
    const st = statusOf(d);
    const v = d.io;
    const n = (id: number) => num(v[id]);

    const saveName = async (name: string) => {
        if (name === (d.name ?? '') || !can(P.deviceUpdate)) return;
        try {
            await rename.mutateAsync({ name });
        } catch (e) {
            toast({ title: 'Gagal menyimpan nama', body: errText(e), level: 'crit' });
        }
    };

    const sendCmd = async (cmd: string) => {
        try {
            await command.mutateAsync({ cmd });
        } catch (e) {
            setErrors((xs) => [...xs, { time: Date.now(), dir: 'err', text: errText(e) }]);
        }
    };

    const gsm = n(21);
    const ext = n(66);
    const fuelPct = n(89);
    const fuelL = n(84);
    const anyCan = [84, 85, 89, 115, 82, 110, 87].some((id) => v[id] != null);
    const terminal: TermLine[] = [
        ...cmdLines.map((l) => ({ time: l.time, dir: l.dir, text: l.text })),
        ...errors,
    ]
        .sort((a, b) => a.time - b.time)
        .slice(-100);

    return (
        <div className="flex flex-col gap-4">
            <Card className="flex-row flex-wrap items-start justify-between gap-4 px-5">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Input
                        className="h-auto border-transparent bg-transparent px-0 text-2xl font-bold tracking-tight shadow-none hover:border-input focus-visible:px-2"
                        aria-label="Nama unit"
                        placeholder={displayName(d)}
                        defaultValue={d.name ?? ''}
                        readOnly={!can(P.deviceUpdate)}
                        onBlur={(e) => void saveName(e.target.value.trim())}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    />
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">IMEI {d.imei}</span>
                        <span>
                            {d.pos
                                ? `${d.pos.lat.toFixed(5)}, ${d.pos.lng.toFixed(5)}`
                                : 'belum ada posisi'}
                        </span>
                        <span>{d.records.toLocaleString('id-ID')} record</span>
                        {d.firstSeen && <span>terdaftar {fmtDateTime(d.firstSeen)}</span>}
                        {d.remote && <span>{d.remote}</span>}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={st} />
                    <Tip
                        label={
                            d.online
                                ? 'Koneksi TCP ke alat sedang terbuka, perintah dapat dikirim'
                                : 'Normal: alat menutup koneksi bila tidak ada data, dan membukanya kembali saat ada record baru'
                        }
                    >
                        <span
                            className={cn(
                                'inline-flex items-center gap-1.5 text-xs',
                                d.online ? 'text-success' : 'text-muted-foreground',
                            )}
                        >
                            <Radio className="size-3.5" />{' '}
                            {d.online ? 'Koneksi terbuka' : 'Koneksi tertutup'}
                        </span>
                    </Tip>
                    <span className="text-xs text-muted-foreground">
                        Data terakhir {ago(d.last?.time)}
                    </span>
                </div>
            </Card>

            <section
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
                aria-label="Ringkasan kondisi"
            >
                <Tile
                    label="Kecepatan"
                    value={d.last?.speed}
                    unit="km/h"
                    sub={d.last ? `arah ${d.last.angle}°` : ''}
                />
                <Tile
                    label="Ignition"
                    value={v[239] == null ? null : v[239] ? 'ON' : 'OFF'}
                    sub={v[240] == null ? '' : v[240] ? 'bergerak' : 'diam'}
                />
                <Tile
                    label="Tegangan aki"
                    value={ext == null ? null : fmtNum(ext / 1000, 2)}
                    unit="V"
                    sub={ext != null && ext < 1000 ? 'tidak ada power 12V' : 'external voltage'}
                />
                <Tile
                    label="Baterai internal"
                    value={n(67) == null ? null : fmtNum(n(67)! / 1000, 2)}
                    unit="V"
                    sub={v[113] != null ? `${v[113]}%` : ''}
                />
                <Tile
                    label="Sinyal GSM"
                    value={gsm}
                    unit="/5"
                    sub={v[241] ? fmtIo(io, 241, v[241]) : ''}
                    extra={
                        gsm != null && (
                            <span
                                className="mr-1.5 inline-flex items-end gap-0.5"
                                aria-hidden="true"
                            >
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <i
                                        key={i}
                                        className={cn(
                                            'w-1 rounded-sm',
                                            i <= gsm ? 'bg-success' : 'bg-muted',
                                        )}
                                        style={{ height: 4 + i * 3 }}
                                    />
                                ))}
                            </span>
                        )
                    }
                />
                <Tile
                    label="Satelit"
                    value={d.last?.sats}
                    sub={v[69] != null ? `GNSS ${fmtIo(io, 69, v[69]).toLowerCase()}` : ''}
                />
                <Tile
                    label="Odometer"
                    value={n(16) == null ? null : fmtNum(n(16)! / 1000, 1)}
                    unit="km"
                    sub={n(199) != null ? `trip ${fmtNum(n(199)! / 1000, 1)} km` : ''}
                />
            </section>

            <Card className="gap-3">
                <CardHeader>
                    <CardTitle>CAN unit</CardTitle>
                    <CardDescription>tergantung unit &amp; Program Number</CardDescription>
                </CardHeader>
                <CardContent>
                    {anyCan ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <Tile
                                label="Level BBM"
                                value={fuelL != null ? fmtNum(fuelL / 10, 1) : fuelPct}
                                unit={fuelL != null ? 'L' : '%'}
                                sub={fuelPct != null ? `${fuelPct}% tangki` : ''}
                                below={
                                    fuelPct != null && (
                                        <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                            <i
                                                className="block h-full rounded-full bg-brand"
                                                style={{ width: `${Math.min(100, fuelPct)}%` }}
                                            />
                                        </span>
                                    )
                                }
                            />
                            <Tile
                                label="RPM mesin"
                                value={n(85) == null ? null : fmtNum(n(85)!)}
                                unit="rpm"
                            />
                            <Tile
                                label="Suhu mesin"
                                value={n(115) == null ? null : fmtNum(n(115)! / 10, 1)}
                                unit="°C"
                            />
                            <Tile label="Pedal gas" value={n(82)} unit="%" />
                            <Tile
                                label="Konsumsi"
                                value={n(110) == null ? null : fmtNum(n(110)! / 10, 1)}
                                unit="L/h"
                            />
                            <Tile
                                label="Mileage CAN"
                                value={n(87) == null ? null : fmtNum(n(87)! / 1000, 1)}
                                unit="km"
                            />
                        </div>
                    ) : (
                        <Empty>
                            Belum ada data CAN. Data ini baru muncul bila FMC150 sudah dipasang ke
                            CAN unit dan Program Number-nya sudah diatur.
                        </Empty>
                    )}
                </CardContent>
            </Card>

            <Card className="gap-3">
                <CardHeader className="flex-wrap">
                    <CardTitle>Riwayat</CardTitle>
                    <ToggleGroup
                        type="single"
                        size="sm"
                        value={rangeMin}
                        onValueChange={(x) => x && onRange(x)}
                        aria-label="Rentang waktu"
                    >
                        {RANGES.map((r) => (
                            <ToggleGroupItem key={r.min} value={r.min}>
                                {r.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                    <LineChart
                        title="Kecepatan"
                        unit="km/h"
                        points={history.map((p) => ({ t: p.t, y: p.speed }))}
                    />
                    <LineChart
                        title="Tegangan aki"
                        unit="V"
                        dec={2}
                        minZero={false}
                        points={history
                            .filter((p) => typeof p.ext === 'number')
                            .map((p) => ({ t: p.t, y: Number(p.ext) / 1000 }))}
                    />
                </CardContent>
            </Card>

            <UnitStatusTimeline imei={d.imei} />

            <div className="grid gap-4 xl:grid-cols-2">
                <Card className="gap-3">
                    <CardHeader>
                        <CardTitle>Event unit ini</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-80 overflow-y-auto">
                        <EventList
                            events={events}
                            devices={devices}
                            empty="Belum ada event untuk unit ini."
                        />
                    </CardContent>
                </Card>
                <Card className="gap-3">
                    <CardHeader>
                        <CardTitle>Kirim perintah (GPRS)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <Terminal
                            lines={terminal}
                            empty="Perintah dikirim lewat koneksi GPRS (Codec 12). Alat harus sedang online."
                        />
                        {can(P.deviceCommand) ? (
                            <CommandBox
                                quick={QUICK}
                                placeholder={
                                    d.online
                                        ? 'Perintah, mis. getstatus'
                                        : 'Menunggu alat membuka koneksi kembali…'
                                }
                                onSend={(c) => void sendCmd(c)}
                                disabled={!d.online}
                            />
                        ) : (
                            <Note tone="info">
                                Akun ini tidak memiliki akses untuk mengirim perintah ke alat.
                            </Note>
                        )}
                        {!d.online && (
                            <Note tone="info">
                                Perintah hanya dapat dikirim saat koneksi terbuka. Alat membuka
                                koneksi kembali begitu ada record baru (gerakkan unitnya, atau
                                tunggu jadwal kirim berikutnya).
                            </Note>
                        )}
                    </CardContent>
                </Card>
            </div>

            <IoTable d={d} io={io} groups={groups} />
        </div>
    );
}

function Tile({
    label,
    value,
    unit,
    sub,
    extra,
    below,
}: {
    label: string;
    value: ReactNode | undefined;
    unit?: string;
    sub?: string;
    extra?: ReactNode;
    below?: ReactNode;
}) {
    const na = value == null || value === '—';
    return (
        <div
            className={cn(
                'flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card px-3.5 py-3',
                na && 'bg-muted/40',
            )}
        >
            <span className="text-xs text-muted-foreground">{label}</span>
            <span
                className={cn(
                    'flex items-end text-2xl font-semibold tabular-nums tracking-tight',
                    na && 'text-muted-foreground',
                )}
            >
                {extra}
                {na ? '—' : value}
                {!na && unit && (
                    <small className="mb-1 ml-1 text-xs font-normal text-muted-foreground">
                        {unit}
                    </small>
                )}
            </span>
            {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
            {below}
        </div>
    );
}

function IoTable({ d, io, groups }: Pick<DetailProps, 'd' | 'io' | 'groups'>) {
    const prev = useRef<Record<string, IoValue>>({});
    const ids = Object.keys(d.io).map(Number);
    const byGroup = new Map<string, number[]>();
    for (const id of ids) {
        const g = io[id]?.group ?? 'other';
        byGroup.set(g, [...(byGroup.get(g) ?? []), id]);
    }
    const changed = new Set(
        ids.filter((id) => prev.current[id] !== undefined && prev.current[id] !== d.io[id]),
    );
    useEffect(() => {
        prev.current = { ...d.io };
    });

    return (
        <Card className="gap-3 pb-1">
            <CardHeader>
                <CardTitle>Semua data IO</CardTitle>
                <CardDescription>{ids.length} parameter</CardDescription>
            </CardHeader>
            <div className="max-h-[520px] overflow-y-auto">
                <Table>
                    <TableHeader className="sticky top-0 z-[1] bg-card">
                        <TableRow>
                            <TableHead className="w-14 text-right">ID</TableHead>
                            <TableHead>Parameter</TableHead>
                            <TableHead>Nilai</TableHead>
                            <TableHead>Mentah</TableHead>
                            <TableHead>Update</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Object.keys(groups), 'other'].map((g) => {
                            const rows = byGroup.get(g);
                            if (!rows) return null;
                            return [
                                <TableRow key={g} className="bg-muted/60 hover:bg-muted/60">
                                    <TableCell
                                        colSpan={5}
                                        className="py-1.5 text-xs font-semibold text-muted-foreground"
                                    >
                                        {groups[g as keyof typeof groups] ??
                                            'Lainnya (belum ada di mapping)'}
                                    </TableCell>
                                </TableRow>,
                                ...rows
                                    .sort((a, b) => a - b)
                                    .map((id) => (
                                        <TableRow
                                            key={`${g}-${id}`}
                                            className={cn(changed.has(id) && 'animate-flash')}
                                        >
                                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                {id}
                                            </TableCell>
                                            <TableCell>{io[id]?.name ?? `IO ${id}`}</TableCell>
                                            <TableCell className="font-medium">
                                                {fmtIo(io, id, d.io[id])}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {String(d.io[id])}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {d.ioTime[id] ? fmtTime(d.ioTime[id]) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    )),
                            ];
                        })}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}
