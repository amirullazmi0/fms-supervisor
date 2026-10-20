'use client';
// Jalur jalan front loading → dumping dan estimasi waktu tempuh unit.
// Bila server routing tidak terjangkau, tampilkan perkiraan kasar dari jarak lurus.
import type { ReactNode } from 'react';
import { fmtDuration, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Empty } from '@/components/ui/misc';
import { distanceM } from '@/lib/geo';
import type { LatLng, RoadRoute, RouteHistory, UsualPath } from '@/types/fleet';

export interface RoadState {
    loading: boolean;
    data: RoadRoute | null;
    error: string | null;
}

// Perkiraan kasar: jalan biasanya ±1,4× jarak lurus, unit rata-rata 40 km/jam.
const DETOUR = 1.4;
const TRUCK_KMH = 40;

const km = (m: number) => `${fmtNum(m / 1000, m < 10000 ? 1 : 0)} km`;

interface Props {
    from: LatLng;
    to: LatLng;
    road: RoadState;
    roadBack?: RoadState; // jalur return (dumping → front loading)
    active: number;
    onActive: (i: number) => void;
    history: RouteHistory | null; // null = rute belum disimpan / belum dimuat
}

export default function RoadInfo(props: Props) {
    return (
        <>
            <HistoryInfo history={props.history} />
            {props.history && props.history.trips > 0 && (
                <>
                    <UsualInfo
                        path={props.history.paths?.go}
                        title="Jalan pergi (loading → dumping)"
                        line="actual"
                    />
                    <UsualInfo
                        path={props.history.paths?.back}
                        title="Jalan return (dumping → front loading)"
                        line="back"
                    />
                </>
            )}
            <PlannedInfo {...props} />
            <BackInfo road={props.roadBack} />
        </>
    );
}

// Kotak info jalur. key = warna garis di peta.
function Box({
    line,
    title,
    children,
}: {
    line: 'actual' | 'back' | 'planned' | 'rough';
    title: ReactNode;
    children: ReactNode;
}) {
    const key = {
        actual: 'bg-success',
        back: 'bg-site-unloading',
        planned: 'bg-info',
        rough: 'bg-[repeating-linear-gradient(90deg,var(--info)_0_5px,transparent_5px_8px)]',
    }[line];
    return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-dashed bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className={cn('inline-block h-1 w-5 rounded-full', key)} aria-hidden="true" />{' '}
                {title}
            </div>
            {children}
        </div>
    );
}

function Nums({ items }: { items: [string, string][] }) {
    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-x-3 gap-y-1.5">
            {items.map(([k, v]) => (
                <span key={k} className="flex flex-col">
                    <small className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                        {k}
                    </small>
                    <span className="text-[13.5px] font-medium tabular-nums">{v}</span>
                </span>
            ))}
        </div>
    );
}

// Dari ritase asli: jalur terakhir yang dilalui + rata-rata waktu tempuh.
function HistoryInfo({ history: h }: { history: RouteHistory | null }) {
    if (!h) return null;
    if (!h.trips) {
        return (
            <Box line="actual" title="Jalur asli unit">
                <Empty>
                    Belum ada ritase selesai di rute ini dalam {h.days} hari terakhir. Garis jalan
                    asli muncul setelah unit pertama kali jalan dari loading ke dumping.
                </Empty>
            </Box>
        );
    }
    const unit = h.fuelUnit;
    return (
        <Box line="actual" title={`Jalur asli unit · ${h.trips} ritase (${h.days} hari)`}>
            <Nums
                items={[
                    ['Rata-rata', fmtDuration(h.avgDurationMs)],
                    ['Tercepat', fmtDuration(h.minDurationMs)],
                    ['Terlama', fmtDuration(h.maxDurationMs)],
                    ['Jarak', km(h.avgDistance)],
                    ['Berhenti', `${fmtNum(h.avgStops, 1)}×`],
                    ['BBM', h.avgFuel != null && unit ? `${fmtNum(h.avgFuel, 1)} ${unit}` : '—'],
                ]}
            />
            {!h.paths?.go && h.latest && (
                <Empty className="text-xs">
                    Garis hijau = ritase terakhir (
                    {new Date(h.latest.end).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                    })}
                    , {fmtDuration(h.latest.durationMs)}, {km(h.latest.distance)}).
                </Empty>
            )}
        </Box>
    );
}

// Jalan yang biasa dilalui operator di satu arah (jejak GPS yang paling mirip ritase lain).
function UsualInfo({
    path,
    title,
    line,
}: {
    path: UsualPath | null | undefined;
    title: string;
    line: 'actual' | 'back';
}) {
    if (!path) {
        return (
            <Box line={line} title={title}>
                <Empty className="text-xs">
                    Belum ada ritase selesai di arah ini. Garisnya muncul setelah unit pertama kali
                    lewat.
                </Empty>
            </Box>
        );
    }
    const share = path.compared ? Math.round((path.follow / path.compared) * 100) : 0;
    return (
        <Box line={line} title={`${title} · ${path.trips} ritase`}>
            <Nums
                items={[
                    ['Jarak', km(path.distance)],
                    ['Waktu', fmtDuration(path.durationMs)],
                    ['Rata-rata', fmtDuration(path.avgDurationMs)],
                    ['Lewat sini', `${path.follow}/${path.compared} (${share}%)`],
                ]}
            />
        </Box>
    );
}

// Jalur return dari routing (garis oranye putus-putus di peta).
function BackInfo({ road }: { road?: RoadState }) {
    const p = road?.data?.paths[0];
    if (!road || road.loading || !p) return null;
    return (
        <Box line="back" title="Jalur return (dumping → front loading)">
            <Nums
                items={[
                    ['Jarak', km(p.distance)],
                    ['Unit ±', fmtDuration(p.truckDurationS * 1000)],
                    ['Unit', fmtDuration(p.durationS * 1000)],
                ]}
            />
        </Box>
    );
}

// Dari routing (OSRM / data jalan OSM), atau perkiraan kasar bila keduanya gagal.
function PlannedInfo({ from, to, road, active, onActive, history }: Props) {
    const straight = distanceM(from, to);

    if (road.loading) return <Empty>Mencari jalur jalan…</Empty>;

    if (!road.data) {
        if (history?.trips) return null; // sudah ada estimasi dari ritase aktual, perkiraan kasar tidak diperlukan
        const est = straight * DETOUR;
        return (
            <Box line="rough" title="Estimasi kasar">
                <Nums
                    items={[
                        ['Jarak ±', km(est)],
                        ['Waktu unit ±', fmtDuration((est / 1000 / TRUCK_KMH) * 3600e3)],
                    ]}
                />
                <Empty className="text-xs">
                    Jalur jalan tidak dapat diambil{road.error ? ` (${road.error})` : ''}. Ini
                    perkiraan dari jarak lurus {km(straight)} × {DETOUR} dengan kecepatan unit{' '}
                    {TRUCK_KMH} km/jam.
                </Empty>
            </Box>
        );
    }

    const { paths, truckFactor } = road.data;
    return (
        <Box line="planned" title="Jalur pergi (loading → dumping)">
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                {paths.map((p, i) => (
                    <li key={i}>
                        <button
                            type="button"
                            aria-pressed={i === active}
                            onClick={() => onActive(i)}
                            className={cn(
                                'flex w-full flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-ring',
                                i === active && 'border-info ring-3 ring-info/20',
                            )}
                        >
                            <span
                                className={cn('text-xs font-semibold', i === active && 'text-info')}
                            >
                                {i === 0 ? 'Jalur utama' : `Alternatif ${i}`}
                            </span>
                            <Nums
                                items={[
                                    ['Jarak', km(p.distance)],
                                    ['Unit ±', fmtDuration(p.truckDurationS * 1000)],
                                    ['Unit', fmtDuration(p.durationS * 1000)],
                                ]}
                            />
                        </button>
                    </li>
                ))}
            </ol>
            <Empty className="text-xs">
                Dari {road.data.source}. Estimasi unit = waktu kendaraan ringan ×{' '}
                {fmtNum(truckFactor, 1)}, belum termasuk macet &amp; istirahat.
            </Empty>
        </Box>
    );
}
