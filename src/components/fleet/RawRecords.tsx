'use client';
// Lacak unit → Data mentah: setiap paket yang dikirim FMC150 di hari yang dipilih, semua nilai
// IO/CAN-nya (nama & satuan dari io-map). Paging di server, terbaru di atas.
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import Pager from '@/components/custom/pager';
import { useData } from '@/provider/StreamProvider';
import { fmtIo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Empty,
    KV,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { IoGroup, IoValue } from '@/types/fleet';
import type { IoTable } from '@/lib/format';

interface RawRecord {
    time: number;
    priority: number;
    lat: number;
    lng: number;
    alt: number;
    angle: number;
    sats: number;
    speed: number;
    eventIo: number;
    valid: boolean;
    io: Record<string, IoValue>;
}

const PER_PAGE = 50;
const GROUP_LABEL: Record<IoGroup, string> = {
    status: 'Status',
    gnss: 'GPS',
    power: 'Daya',
    io: 'Input / output',
    driving: 'Mengemudi',
    can: 'CAN / unit',
};
const GROUP_ORDER: IoGroup[] = ['status', 'driving', 'can', 'power', 'io', 'gnss'];
const time = (ms: number) =>
    new Date(ms).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
// Tampilan ringkas: kolom IO yang paling sering diperiksa. Lengkap: semua IO yang ada di halaman ini.
const SHORT: string[] = ['239', '240', '66', '84', '89', '16'];
const groupRank = (g: IoGroup | undefined) => (g ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
const osm = (lat: number, lng: number) =>
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
const sticky = 'sticky left-0 z-[1] bg-card';

export default function RawRecords({ imei, date }: { imei: string; date: string }) {
    const { io } = useData();
    const [paging, setPaging] = useState({ key: '', page: 1 });
    const key = `${imei}|${date}`;
    const page = paging.key === key ? paging.page : 1;
    const [picked, setPicked] = useState<RawRecord | null>(null);
    const from = new Date(`${date}T00:00:00`).getTime();
    const to = new Date(`${date}T23:59:59.999`).getTime();

    const q = useQueryApiRequest<GlobalApiResponse<RawRecord[]>>({
        key: 'devices-raw',
        params: { imei },
        queries: { from, to, page, limit: PER_PAGE },
        config: { errorNotification: false },
        options: { placeholderData: (prev) => prev, refetchInterval: 30000 },
    });
    const rows = useMemo(() => q.data?.data ?? [], [q.data]);
    const [full, setFull] = useState(true);
    // Kolom IO: gabungan semua IO di halaman ini, urut per grup (status, mengemudi, CAN, daya, I/O, GPS) lalu ID.
    const ioCols = useMemo(() => {
        const ids = [...new Set(rows.flatMap((r) => Object.keys(r.io)))];
        const list = full ? ids : SHORT.filter((id) => ids.includes(id));
        return list.sort(
            (a, b) => groupRank(io[a]?.group) - groupRank(io[b]?.group) || Number(a) - Number(b),
        );
    }, [rows, full, io]);

    const csv = () => {
        const ids = [...new Set(rows.flatMap((r) => Object.keys(r.io)))].sort(
            (a, b) => Number(a) - Number(b),
        );
        const head = [
            'time',
            'lat',
            'lng',
            'alt',
            'angle',
            'sats',
            'speed',
            'priority',
            'event_io',
            'valid',
            ...ids.map((id) =>
                `${id} ${io[id]?.name ?? ''}${io[id]?.unit ? ` (${io[id].unit}${io[id].scale ? ` x${io[id].scale}` : ''})` : ''}`.trim(),
            ),
        ];
        const lines = rows.map((r) =>
            [
                new Date(r.time).toISOString(),
                r.lat,
                r.lng,
                r.alt,
                r.angle,
                r.sats,
                r.speed,
                r.priority,
                r.eventIo,
                r.valid,
                ...ids.map((id) => r.io[id] ?? ''),
            ].join(','),
        );
        const blob = new Blob([[head.map((h) => `"${h}"`).join(','), ...lines].join('\n')], {
            type: 'text/csv',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `fmc150-${imei}-${date}-hal${page}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                    Semua paket dari alat di tanggal ini, terbaru di atas. Geser ke kanan untuk
                    kolom lain, klik baris untuk detail.
                </span>
                <div className="flex items-center gap-2">
                    <ToggleGroup
                        type="single"
                        value={full ? 'full' : 'short'}
                        onValueChange={(v) => v && setFull(v === 'full')}
                        aria-label="Kolom"
                    >
                        <ToggleGroupItem value="full">Lengkap</ToggleGroupItem>
                        <ToggleGroupItem value="short">Ringkas</ToggleGroupItem>
                    </ToggleGroup>
                    <Button variant="outline" size="sm" disabled={!rows.length} onClick={csv}>
                        <Download /> CSV
                    </Button>
                </div>
            </div>
            {q.isLoading ? (
                <Empty>Memuat…</Empty>
            ) : rows.length === 0 ? (
                <Empty>Belum ada data dari unit ini di tanggal ini.</Empty>
            ) : (
                <div className={cn('rounded-lg border', q.isFetching && 'opacity-70')}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className={sticky}>Waktu</TableHead>
                                <TableHead>Posisi (lat, lng)</TableHead>
                                <TableHead className="text-right">Km/j</TableHead>
                                <TableHead className="text-right">Arah</TableHead>
                                <TableHead className="text-right">Tinggi</TableHead>
                                <TableHead className="text-right">Sat</TableHead>
                                {full && <TableHead>GPS</TableHead>}
                                {full && <TableHead className="text-right">Prio</TableHead>}
                                <TableHead>Event</TableHead>
                                {ioCols.map((id) => (
                                    <TableHead
                                        key={id}
                                        className="whitespace-nowrap text-right"
                                        title={`IO ${id}${io[id]?.group ? ` · ${GROUP_LABEL[io[id].group]}` : ''}`}
                                    >
                                        {io[id]?.name ?? `IO ${id}`}
                                        <span className="ml-1 font-normal normal-case text-muted-foreground/70">
                                            {id}
                                        </span>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => (
                                <TableRow
                                    key={`${r.time}-${r.eventIo}-${r.priority}`}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setPicked(r)}
                                >
                                    <TableCell
                                        className={cn(
                                            sticky,
                                            'whitespace-nowrap font-mono text-xs',
                                        )}
                                    >
                                        {time(r.time)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap font-mono text-xs">
                                        <a
                                            href={osm(r.lat, r.lng)}
                                            target="_blank"
                                            rel="noopener"
                                            className="hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {r.lat.toFixed(6)}, {r.lng.toFixed(6)}
                                        </a>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {r.speed}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {r.angle}°
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                                        {r.alt} m
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {r.sats}
                                    </TableCell>
                                    {full && (
                                        <TableCell>
                                            {r.valid ? (
                                                <Badge variant="success">Valid</Badge>
                                            ) : (
                                                <Badge variant="muted">No GPS</Badge>
                                            )}
                                        </TableCell>
                                    )}
                                    {full && (
                                        <TableCell className="text-right tabular-nums">
                                            {r.priority}
                                        </TableCell>
                                    )}
                                    <TableCell className="whitespace-nowrap text-xs">
                                        {r.eventIo
                                            ? (io[r.eventIo]?.name ?? `IO ${r.eventIo}`)
                                            : '—'}
                                    </TableCell>
                                    {ioCols.map((id) => (
                                        <TableCell
                                            key={id}
                                            className="whitespace-nowrap text-right tabular-nums"
                                        >
                                            {fmtIo(io, id, r.io[id])}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            <Pager meta={q.data?.meta} onPage={(p) => setPaging({ key, page: p })} />

            <Dialog open={picked != null} onOpenChange={(o) => !o && setPicked(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Paket {picked ? new Date(picked.time).toLocaleString('id-ID') : ''}
                        </DialogTitle>
                        <DialogDescription>
                            Data mentah satu paket AVL (Codec 8E) beserta semua IO / CAN.
                        </DialogDescription>
                    </DialogHeader>
                    {picked && <RecordDetail r={picked} io={io} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RecordDetail({ r, io }: { r: RawRecord; io: IoTable }) {
    const byGroup = new Map<IoGroup | 'other', [string, string][]>();
    for (const [id, raw] of Object.entries(r.io).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const def = io[id];
        const g = def?.group ?? 'other';
        byGroup.set(g, [
            ...(byGroup.get(g) ?? []),
            [`${def?.name ?? 'IO'} (${id})`, fmtIo(io, id, raw)],
        ]);
    }
    const groups = [...GROUP_ORDER, 'other' as const].filter((g) => byGroup.has(g));
    return (
        <div className="flex flex-col gap-4">
            <KV
                rows={[
                    [
                        'Koordinat',
                        <span key="c" className="font-mono text-xs">
                            {r.lat.toFixed(6)}, {r.lng.toFixed(6)}
                        </span>,
                    ],
                    ['Kecepatan / arah', `${r.speed} km/jam · ${r.angle}°`],
                    ['Ketinggian', `${r.alt} m`],
                    ['Satelit', `${r.sats}${r.valid ? '' : ' (posisi tidak valid)'}`],
                    ['Prioritas', String(r.priority)],
                    ['Event', r.eventIo ? `${io[r.eventIo]?.name ?? 'IO'} (${r.eventIo})` : '—'],
                ]}
            />
            {groups.map((g) => (
                <section key={g} className="flex flex-col gap-1">
                    <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {g === 'other' ? 'Lainnya' : GROUP_LABEL[g]}
                    </h3>
                    <KV rows={byGroup.get(g)!} />
                </section>
            ))}
            <details className="rounded-lg border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                    JSON mentah
                </summary>
                <pre className="m-0 max-h-60 overflow-auto border-t bg-muted p-3 font-mono text-[11px]">
                    {JSON.stringify(r, null, 2)}
                </pre>
            </details>
        </div>
    );
}
