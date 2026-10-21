'use client';
// Lacak unit: daftar armada (dengan progres rute front loading → dumping) + peta penuh
// dengan kartu detail mengambang (info, operator, perjalanan, ritase, sensor) dan putar ulang rute.
import { useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Copy,
    Layers,
    LocateFixed,
    Pause,
    Play,
    Truck,
} from 'lucide-react';
import TrackMap from '@/components/fleet/TrackMap';
import SpeedGauge from '@/components/fleet/SpeedGauge';
import VehicleSensors from '@/components/fleet/VehicleSensors';
import RouteReport from '@/components/fleet/RouteReport';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import { useDone, useDuty, workState } from '@/lib/duty';
import type { Duty } from '@/lib/duty';
import type { Basemap } from '@/lib/basemap';
import { useData, useStream, useTick } from '@/provider/StreamProvider';
import useFetchApi from '@/hooks/react-query/useFetchApi';
import {
    ago,
    dateKey,
    fmtDuration,
    fmtHm,
    fmtKm,
    fmtNum,
    fmtTime,
    lastHeard,
    num,
    statusOf,
    truckLabel,
} from '@/lib/format';
import type { Status } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, SearchInput } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RawRecords from '@/components/fleet/RawRecords';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Avatar, Empty, KV, Stat, StatusBadge, Tip } from '@/components/ui/misc';
import { distanceM } from '@/lib/geo';
import type { DaySummary, Device, RouteHistory, Site, TripSegment } from '@/types/fleet';

const SPEEDS = ['1', '4', '16'];

type FleetTab = 'all' | 'duty' | 'idle';

// Posisi unit di antara front loading dan dumping rutenya: 0 = di front loading, 1 = di dumping.
function progressOf(d: Device, from: Site | undefined, to: Site | undefined): number | null {
    if (!d.pos || !from || !to) return null;
    const a = distanceM(d.pos, from);
    const b = distanceM(d.pos, to);
    return a + b > 0 ? Math.min(1, Math.max(0, a / (a + b))) : 0;
}

export default function TrackView() {
    const { devices, ready, status, sites, routes } = useData();
    const fetchApi = useFetchApi();
    const { setStats } = useLayout();
    useTick(1000);

    const [selected, setSelected] = useQueryState('unit'); // ?unit=<imei>: bisa dibuka langsung dari Beranda
    const [date, setDate] = useState(() => dateKey());
    const [day, setDay] = useState<DaySummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [focus, setFocus] = useState<number | null>(null);
    const [follow, setFollow] = useState(true);
    const [playIdx, setPlayIdx] = useState<number | null>(null);
    const [playing, setPlaying] = useState(false);
    const [rate, setRate] = useState('4');
    const [ritase, setRitase] = useState<{ start: number; end: number } | null>(null);
    const [basemap, setBasemap] = useState<Basemap>('map');
    const [showRoutes, setShowRoutes] = useState(true);
    const duty = useDuty();
    // Urutan tetap agar kartu tidak berpindah-pindah setiap ada data masuk:
    // yang sedang bertugas di atas, lalu yang online, lalu offline; di dalamnya urut nama/plat.
    const list = useMemo(() => {
        const rank = (x: Device) => (duty.has(x.imei) ? 0 : statusOf(x) !== 'offline' ? 1 : 2);
        return Object.values(devices).sort(
            (a, b) =>
                rank(a) - rank(b) ||
                truckLabel(a).localeCompare(truckLabel(b), 'id', { numeric: true }),
        );
    }, [devices, duty]);
    const [tab, setTab] = useState<FleetTab>('all');
    const [q, setQ] = useState('');

    const isToday = date === dateKey();
    const d = selected ? devices[selected] : undefined;
    const siteById = useMemo(() => new Map(sites.map((x) => [x.id, x])), [sites]);
    const routeById = useMemo(() => new Map(routes.map((x) => [x.id, x])), [routes]);
    const endsOf = (imei: string) => {
        const job = duty.get(imei);
        const r = job ? routeById.get(job.routeId) : undefined;
        return {
            from: r ? siteById.get(r.loadingId) : undefined,
            to: r ? siteById.get(r.unloadingId) : undefined,
        };
    };

    // Titik dari rute-rute unit yang dipilih, beserta perannya (front loading / dumping) di rute itu.
    const { truckSites, siteRoles } = useMemo(() => {
        const roles = new Map<string, 'loading' | 'unloading'>();
        if (selected) {
            for (const r of routes.filter((x) => x.imeis.includes(selected))) {
                roles.set(r.loadingId, 'loading');
                if (!roles.has(r.unloadingId)) roles.set(r.unloadingId, 'unloading');
            }
        }
        return { truckSites: sites.filter((x) => roles.has(x.id)), siteRoles: roles };
    }, [sites, routes, selected]);

    // Garis jalan rute unit: jejak ritase terakhir. Belum pernah berjalan = garis lurus front loading -> dumping.
    const truckRoutes = useMemo(
        () => (selected ? routes.filter((r) => r.imeis.includes(selected)) : []),
        [routes, selected],
    );
    const routesKey = truckRoutes.map((r) => `${r.id}:${r.updatedAt}`).join(',');
    const [routeLines, setRouteLines] = useState<
        { id: string; name: string; coords: [number, number][]; actual: boolean }[]
    >([]);
    useEffect(() => {
        let alive = true;
        void Promise.all(
            truckRoutes.map(async (r) => {
                const h = await fetchApi<RouteHistory>('routes-history', { id: r.id }).catch(
                    () => null,
                );
                const a = siteById.get(r.loadingId);
                const b = siteById.get(r.unloadingId);
                if (h?.latest)
                    return { id: r.id, name: r.name, coords: h.latest.coords, actual: true };
                if (a && b)
                    return {
                        id: r.id,
                        name: r.name,
                        coords: [
                            [a.lat, a.lng],
                            [b.lat, b.lng],
                        ] as [number, number][],
                        actual: false,
                    };
                return null;
            }),
        ).then(
            (lines) =>
                alive && setRouteLines(lines.filter((x): x is NonNullable<typeof x> => x != null)),
        );
        return () => {
            alive = false;
        };
        // routesKey mewakili truckRoutes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routesKey, siteById]);

    useEffect(() => {
        if ((!selected || !devices[selected]) && list.length) setSelected(list[0].imei);
        if (selected && !devices[selected] && !list.length) setSelected(null);
    }, [list, selected, devices]);

    // Ringkasan perjalanan tanggal yang dipilih.
    const load = useCallback(
        async (imei: string, key: string, quiet: boolean) => {
            const from = new Date(`${key}T00:00:00`).getTime();
            const to = Math.min(from + 86400e3 - 1, Date.now());
            if (!quiet) setLoading(true);
            try {
                setDay((await fetchApi<DaySummary>('devices-day', { imei }, { from, to })) ?? null);
            } catch {
                if (!quiet) setDay(null);
            } finally {
                setLoading(false);
            }
        },
        [fetchApi],
    );

    useEffect(() => {
        setDay(null);
        setFocus(null);
        setPlayIdx(null);
        setPlaying(false);
        setRitase(null);
        if (selected) void load(selected, date, false);
    }, [selected, date, load]);

    // Hari ini: muat ulang saat ada titik baru, dan setiap 30 detik (nama jalan menyusul dari server).
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useStream((msg) => {
        if (msg.type !== 'point' || msg.imei !== selected || !isToday) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void load(msg.imei, date, true), 2500);
    });
    useEffect(() => {
        if (!selected || !isToday) return;
        const t = setInterval(() => void load(selected, date, true), 30000);
        return () => clearInterval(t);
    }, [selected, date, isToday, load]);

    // Putar ulang rute
    const total = day?.points.length ?? 0;
    useEffect(() => {
        if (!playing || total < 2) return;
        const t = setInterval(
            () => {
                setPlayIdx((i) => {
                    const next = (i ?? 0) + 1;
                    if (next >= total) {
                        setPlaying(false);
                        return total - 1;
                    }
                    return next;
                });
            },
            600 / Number(rate),
        );
        return () => clearInterval(t);
    }, [playing, total, rate]);
    const playhead =
        playIdx != null && day ? (day.points[Math.min(playIdx, total - 1)] ?? null) : null;

    // Ringkasan di header
    const counts = useMemo(() => {
        const c: Record<Status, number> = { moving: 0, idle: 0, parked: 0, offline: 0 };
        list.forEach((x) => c[statusOf(x)]++);
        return c;
    }, [list]);
    const nDuty = list.filter((x) => duty.has(x.imei)).length;
    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Unit" value={list.length} />
                <HeaderStat label="Bertugas" value={nDuty} />
                <HeaderStat label="Jalan" value={counts.moving} />
                <HeaderStat label="Berhenti" value={counts.idle + counts.parked} />
                {counts.offline > 0 && (
                    <HeaderStat label="Offline" value={counts.offline} tone="danger" />
                )}
            </>,
        );
    }, [setStats, list.length, nDuty, counts]);
    useEffect(() => () => setStats(null), [setStats]);

    const needle = q.trim().toLowerCase();
    const shown = list.filter((x) => {
        const job = duty.get(x.imei);
        if (tab === 'duty' && !job) return false;
        if (tab === 'idle' && job) return false;
        if (!needle) return true;
        return [truckLabel(x), x.name, x.vehicle, x.imei, job?.driverName, job?.routeName].some(
            (v) => v?.toLowerCase().includes(needle),
        );
    });
    const tabs: { id: FleetTab; label: string; n: number }[] = [
        { id: 'all', label: 'Semua', n: list.length },
        { id: 'duty', label: 'Bertugas', n: nDuty },
        { id: 'idle', label: 'Tidak bertugas', n: list.length - nDuty },
    ];
    const ends = d ? endsOf(d.imei) : { from: undefined, to: undefined };

    return (
        <div className="relative flex min-h-full flex-col lg:grid lg:h-full lg:grid-cols-[360px_minmax(0,1fr)]">
            {/* Daftar armada */}
            <aside
                className="order-3 flex flex-col gap-3 border-t bg-card p-4 lg:order-none lg:overflow-y-auto lg:border-r lg:border-t-0"
                aria-label="Daftar unit"
            >
                <SearchInput
                    placeholder="Cari plat, operator, rute…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Cari unit"
                />
                <Tabs value={tab} onValueChange={(v) => setTab(v as FleetTab)}>
                    <TabsList className="w-full">
                        {tabs.map((t) => (
                            <TabsTrigger key={t.id} value={t.id}>
                                {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                <div className="flex items-center gap-2 text-sm font-semibold">
                    {tabs.find((t) => t.id === tab)!.label}
                    <Badge variant="brand" className="tabular-nums">
                        {shown.length}
                    </Badge>
                </div>

                {ready && list.length === 0 && (
                    <Empty>
                        Belum ada unit yang terdaftar. Untuk contoh, jalankan{' '}
                        <code className="font-mono">go run ./cmd/simulator</code>. Alamat untuk alat
                        asli:{' '}
                        <span className="font-mono">
                            {status?.tunnel
                                ? `${status.tunnel.host}:${status.tunnel.port}`
                                : status && !status.tunnelEnabled
                                  ? `IP/domain server:${status.devicePort}`
                                  : 'tunnel belum aktif'}
                        </span>
                    </Empty>
                )}
                {list.length > 0 && shown.length === 0 && <Empty>Tidak ada unit yang cocok.</Empty>}

                <ul className="m-0 flex list-none gap-2.5 overflow-x-auto p-0 pb-1 max-lg:snap-x max-lg:snap-mandatory lg:flex-col lg:overflow-visible lg:pb-0">
                    {shown.map((x) => (
                        <li
                            key={x.imei}
                            className="max-lg:w-[min(86%,340px)] max-lg:shrink-0 max-lg:snap-start"
                        >
                            <FleetCard
                                d={x}
                                job={duty.get(x.imei)}
                                {...endsOf(x.imei)}
                                selected={x.imei === selected}
                                onClick={() => setSelected(x.imei)}
                            />
                        </li>
                    ))}
                </ul>
            </aside>

            {/* Peta */}
            <section className="relative order-1 h-[62dvh] min-h-[380px] p-2 lg:order-none lg:h-auto lg:p-3">
                <div className="isolate h-full overflow-hidden rounded-2xl border">
                    <TrackMap
                        devices={list}
                        selected={selected}
                        onSelect={setSelected}
                        day={day}
                        focus={focus}
                        playhead={playhead}
                        follow={follow && isToday}
                        fitKey={`${selected}|${date}|${day ? 'ok' : ''}`}
                        sites={truckSites}
                        siteRoles={siteRoles}
                        routeLines={routeLines}
                        highlight={ritase}
                        basemap={basemap}
                        showRoutes={showRoutes}
                    />
                </div>

                <div className="absolute right-5 top-5 z-[1000] flex items-center gap-2 lg:right-6 lg:top-6">
                    <ToggleGroup
                        type="single"
                        value={basemap}
                        onValueChange={(v) => v && setBasemap(v as Basemap)}
                        className="shadow-lg"
                        aria-label="Jenis peta"
                    >
                        <ToggleGroupItem value="map">Peta</ToggleGroupItem>
                        <ToggleGroupItem value="sat">Satelit</ToggleGroupItem>
                    </ToggleGroup>
                    <Tip label="Front loading/dumping & jalur rute">
                        <Button
                            variant="outline"
                            className={cn('shadow-lg', showRoutes && 'border-ring')}
                            aria-pressed={showRoutes}
                            onClick={() => setShowRoutes(!showRoutes)}
                        >
                            <Layers /> <span className="max-sm:hidden">Lapisan</span>
                        </Button>
                    </Tip>
                    <Tip label="Peta mengikuti unit yang dipilih">
                        <Button
                            variant="outline"
                            className={cn('shadow-lg', follow && 'border-ring')}
                            aria-pressed={follow}
                            onClick={() => setFollow(!follow)}
                        >
                            <LocateFixed /> <span className="max-sm:hidden">Ikuti</span>
                        </Button>
                    </Tip>
                </div>

                <div className="absolute inset-x-5 bottom-5 z-[1000] mx-auto flex max-w-2xl flex-wrap items-center gap-2.5 rounded-xl border bg-card p-2 shadow-lg lg:inset-x-6 lg:bottom-6">
                    <Button
                        size="sm"
                        disabled={total < 2}
                        onClick={() => {
                            if (!playing && (playIdx == null || playIdx >= total - 1))
                                setPlayIdx(0);
                            setPlaying(!playing);
                        }}
                    >
                        {playing ? <Pause /> : <Play />} {playing ? 'Jeda' : 'Putar rute'}
                    </Button>
                    <input
                        type="range"
                        className="min-w-24 flex-1 accent-primary max-sm:order-last max-sm:basis-full"
                        min={0}
                        max={Math.max(0, total - 1)}
                        value={playIdx ?? Math.max(0, total - 1)}
                        disabled={total < 2}
                        aria-label="Posisi putar ulang"
                        onChange={(e) => {
                            setPlaying(false);
                            setPlayIdx(Number(e.target.value));
                        }}
                    />
                    <span className="font-mono text-xs text-muted-foreground max-sm:flex-1">
                        {playhead
                            ? `${fmtTime(playhead.t)} · ${playhead.speed} km/jam`
                            : total
                              ? `${total} titik`
                              : 'belum ada rute'}
                    </span>
                    <ToggleGroup
                        type="single"
                        size="sm"
                        value={rate}
                        onValueChange={(v) => v && setRate(v)}
                        aria-label="Kecepatan putar ulang"
                    >
                        {SPEEDS.map((s) => (
                            <ToggleGroupItem key={s} value={s}>
                                {s}×
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    {playIdx != null && (
                        <Button
                            variant="link"
                            size="sm"
                            onClick={() => {
                                setPlaying(false);
                                setPlayIdx(null);
                            }}
                        >
                            Selesai
                        </Button>
                    )}
                </div>
            </section>

            {/* Detail: mengambang di atas peta (desktop), kartu di bawah peta (HP) */}
            {d && (
                <DetailCard
                    key={d.imei}
                    d={d}
                    job={duty.get(d.imei)}
                    from={ends.from}
                    to={ends.to}
                    day={day}
                    loading={loading}
                    date={date}
                    isToday={isToday}
                    onDate={setDate}
                    focus={focus}
                    onFocus={setFocus}
                    ritase={ritase}
                    onRitase={setRitase}
                />
            )}
        </div>
    );
}

// ---------- Kartu unit di daftar ----------
function FleetCard({
    d,
    job,
    from,
    to,
    selected,
    onClick,
}: {
    d: Device;
    job: Duty | undefined;
    from: Site | undefined;
    to: Site | undefined;
    selected: boolean;
    onClick: () => void;
}) {
    const st = statusOf(d);
    const p = job ? progressOf(d, from, to) : null;
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={cn(
                'flex w-full flex-col gap-3 rounded-xl border bg-muted/40 p-3 text-left transition-[border-color,box-shadow] hover:border-ring',
                selected && 'border-info bg-card ring-3 ring-info/15',
            )}
        >
            <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-card">
                    <Truck className="size-4" />
                </span>
                <b className="truncate text-sm">{truckLabel(d)}</b>
                {job && (
                    <span className="ml-auto min-w-0 truncate rounded-md border bg-card px-2 py-0.5 text-[11.5px] font-semibold">
                        <span className="font-normal text-muted-foreground">Operator:</span>{' '}
                        {job.driverName}
                    </span>
                )}
                <StatusBadge status={st} className={cn(!job && 'ml-auto')} />
            </span>
            {job && from && to ? (
                <span className="grid grid-cols-[auto_minmax(40px,1fr)_auto] items-center gap-2.5 text-[12.5px]">
                    <span className="max-w-28 truncate font-semibold">{from.name}</span>
                    <span className="relative h-0.5 bg-[repeating-linear-gradient(90deg,var(--muted-foreground)_0_3px,transparent_3px_6px)] opacity-80">
                        <i className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-foreground" />
                        {p != null && (
                            <span
                                className={cn(
                                    'absolute top-1/2 grid h-5 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md bg-muted',
                                    selected && 'bg-card text-info',
                                )}
                                style={{ left: `${p * 100}%` }}
                            >
                                <Truck className="size-3.5" />
                            </span>
                        )}
                        <i className="absolute -right-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-foreground" />
                    </span>
                    <span className="max-w-28 truncate font-semibold">{to.name}</span>
                </span>
            ) : (
                <span className="truncate text-[12.5px] text-muted-foreground">
                    {job ? job.routeName : <IdleText imei={d.imei} />} ·{' '}
                    {st === 'moving'
                        ? `${d.last?.speed ?? 0} km/jam`
                        : `update ${ago(lastHeard(d))}`}
                </span>
            )}
        </button>
    );
}

// ---------- Kartu detail ----------
interface DetailProps {
    d: Device;
    job: Duty | undefined;
    from: Site | undefined;
    to: Site | undefined;
    day: DaySummary | null;
    loading: boolean;
    date: string;
    isToday: boolean;
    onDate: (key: string) => void;
    focus: number | null;
    onFocus: (i: number | null) => void;
    ritase: { start: number; end: number } | null;
    onRitase: (r: { start: number; end: number } | null) => void;
}

function DetailCard(props: DetailProps) {
    const { d, job } = props;
    const toast = useToast();
    const [collapsed, setCollapsed] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(d.imei);
            toast({ title: 'IMEI disalin', body: d.imei });
        } catch {
            toast({ title: 'Gagal menyalin', body: d.imei, level: 'warn' });
        }
    };

    return (
        <section
            aria-label="Detail unit"
            className={cn(
                'order-2 m-2 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs',
                'lg:absolute lg:left-[calc(360px+1.5rem)] lg:top-6 lg:z-[1000] lg:m-0 lg:w-[min(400px,calc(100%-360px-3rem))] lg:shadow-xl',
                !collapsed && 'lg:max-h-[calc(100%-7.5rem)]',
            )}
        >
            <header className="flex items-center gap-2 px-4 py-3">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
                    <span className="text-muted-foreground">Unit</span>
                    <b className="truncate text-[15px]">{truckLabel(d)}</b>
                    <Tip label="Salin IMEI">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-7"
                            onClick={() => void copy()}
                            aria-label="Salin IMEI"
                        >
                            <Copy className="size-3.5" />
                        </Button>
                    </Tip>
                </span>
                <WorkBadge imei={d.imei} job={job} />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="max-lg:hidden"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? 'Buka detail' : 'Ciutkan detail'}
                >
                    {collapsed ? <ChevronDown /> : <ChevronUp />}
                </Button>
            </header>
            {!collapsed && (
                <Tabs defaultValue="info" className="min-h-0 flex-1 gap-0">
                    <TabsList className="mx-4 mb-3 w-[calc(100%-2rem)] justify-start overflow-x-auto scrollbar-none">
                        <TabsTrigger value="info">Info unit</TabsTrigger>
                        <TabsTrigger value="driver">Operator</TabsTrigger>
                        <TabsTrigger value="trip">Perjalanan</TabsTrigger>
                        <TabsTrigger value="ritase">Ritase</TabsTrigger>
                        <TabsTrigger value="sensor">Sensor</TabsTrigger>
                        <TabsTrigger value="raw">Data mentah</TabsTrigger>
                    </TabsList>
                    <div className="min-h-0 overflow-y-auto px-4 pb-4">
                        <TabsContent value="info">
                            <InfoTab {...props} />
                        </TabsContent>
                        <TabsContent value="driver">
                            <DriverTab job={job} />
                        </TabsContent>
                        <TabsContent value="trip">
                            <TripTab {...props} />
                        </TabsContent>
                        <TabsContent value="ritase">
                            <RouteReport
                                imei={d.imei}
                                date={props.date}
                                isToday={props.isToday}
                                selected={props.ritase?.start ?? null}
                                onSelect={props.onRitase}
                            />
                        </TabsContent>
                        <TabsContent value="sensor">
                            <VehicleSensors d={d} day={props.day} />
                        </TabsContent>
                        <TabsContent value="raw">
                            <RawRecords imei={d.imei} date={props.date} />
                        </TabsContent>
                    </div>
                </Tabs>
            )}
        </section>
    );
}

function InfoTab({ d, job, from, to }: DetailProps) {
    const [place, setPlace] = useState<string | null>(null);
    const fetchApi = useFetchApi();
    const st = statusOf(d);
    const stale = Date.now() - lastHeard(d) > 5 * 60e3;
    const n = (id: number) => num(d.io[id]);
    const ext = n(66);
    const gsm = n(21);
    const fuelPct = n(89);
    const p = job ? progressOf(d, from, to) : null;

    // Nama jalan posisi sekarang (server mencari ke OpenStreetMap, jadi bisa menyusul).
    const posKey = d.pos ? `${d.pos.lat.toFixed(4)},${d.pos.lng.toFixed(4)}` : '';
    useEffect(() => {
        if (!d.pos) return;
        let alive = true;
        let tries = 0;
        const ask = async () => {
            const r = await fetchApi<{ place: string | null }>('place', undefined, {
                lat: d.pos!.lat,
                lng: d.pos!.lng,
            }).catch(() => null);
            if (!alive) return;
            if (r?.place) setPlace(r.place);
            else if (++tries < 4) setTimeout(() => void ask(), 2500);
        };
        void ask();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posKey]);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[120px_1fr] items-center gap-3 rounded-xl bg-muted/60 p-3">
                <SpeedGauge speed={d.last ? d.last.speed : null} stale={stale} />
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                    <StatusBadge status={st} />
                    <span className="text-[13px] font-medium leading-snug">
                        {place ??
                            (d.pos
                                ? `${d.pos.lat.toFixed(5)}, ${d.pos.lng.toFixed(5)}`
                                : 'Belum ada posisi')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        Update {ago(lastHeard(d))}
                    </span>
                </div>
            </div>

            <KV
                rows={[
                    ...(job
                        ? ([
                              ['Shift', job.shiftName],
                              ['Rute', job.routeName],
                              ['Loading', from?.name ?? '—'],
                              ['Dumping', to?.name ?? '—'],
                              ...(p != null
                                  ? [['Progres', `${Math.round(p * 100)}% menuju dumping`]]
                                  : []),
                              ...(job.phase === 'finishing'
                                  ? [
                                        [
                                            'Status',
                                            'Shift dihentikan, menyelesaikan ritase terakhir (hauling / dumping)',
                                        ],
                                    ]
                                  : []),
                          ] as [string, string][])
                        : ([['Tugas', <IdleText key="t" imei={d.imei} long />]] as [
                              string,
                              React.ReactNode,
                          ][])),
                    ['Jenis unit', d.vehicle || '—'],
                    ['IMEI', <span className="font-mono text-xs">{d.imei}</span>],
                ]}
            />

            <div className="grid grid-cols-3 gap-2" aria-label="Kondisi unit">
                <Mini
                    label="Mesin"
                    value={d.io[239] == null ? '—' : d.io[239] ? 'Menyala' : 'Mati'}
                />
                <Mini label="Aki" value={ext == null ? '—' : `${fmtNum(ext / 1000, 1)} V`} />
                <Mini label="Sinyal" value={gsm == null ? '—' : `${gsm}/5`} />
                <Mini label="Satelit" value={d.last ? String(d.last.sats) : '—'} />
                {fuelPct != null && <Mini label="BBM" value={`${fuelPct}%`} />}
                {n(16) != null && <Mini label="Odometer" value={`${fmtKm(n(16)!)} km`} />}
            </div>
        </div>
    );
}

function Mini({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex min-w-0 flex-col rounded-lg border px-2.5 py-2">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <span className="truncate text-[13.5px] font-semibold">{value}</span>
        </div>
    );
}

function DriverTab({ job }: { job: Duty | undefined }) {
    const { drivers } = useData();
    if (!job)
        return (
            <Empty>
                Unit ini sedang tidak bertugas. Operator tampil di sini bila unit ditugaskan di
                shift yang sedang berjalan (menu Shift).
            </Empty>
        );
    const dr = drivers.find((x) => x.id === job.driverId);
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Avatar name={job.driverName} className="size-11 text-base" />
                <span className="flex flex-col">
                    <b className="text-[15px]">{job.driverName}</b>
                    <small className="text-muted-foreground">Shift {job.shiftName}</small>
                </span>
            </div>
            <KV
                rows={[
                    ['No. karyawan', dr?.employeeNo ?? '—'],
                    [
                        'No. HP',
                        dr?.phone ? (
                            <a className="text-info hover:underline" href={`tel:${dr.phone}`}>
                                {dr.phone}
                            </a>
                        ) : (
                            '—'
                        ),
                    ],
                    ['Rute', job.routeName],
                    [
                        'iButton',
                        dr?.ibutton ? <span className="font-mono text-xs">{dr.ibutton}</span> : '—',
                    ],
                ]}
            />
        </div>
    );
}

function TripTab({ day, loading, date, isToday, onDate, focus, onFocus }: DetailProps) {
    const segments = day?.segments ?? [];
    let stopNo = 0;
    const rows = segments
        .map((seg, i) => ({ seg, i, stopNo: seg.type === 'stop' ? ++stopNo : 0 }))
        .reverse();
    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="m-0 text-sm font-semibold">
                    {isToday ? 'Perjalanan hari ini' : 'Perjalanan'}
                </h3>
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        className="h-8 w-38"
                        value={date}
                        max={dateKey()}
                        aria-label="Pilih tanggal"
                        onChange={(e) => e.target.value && onDate(e.target.value)}
                    />
                    {!isToday && (
                        <Button variant="link" size="sm" onClick={() => onDate(dateKey())}>
                            Hari ini
                        </Button>
                    )}
                </div>
            </div>

            {loading && !day ? (
                <Empty>Memuat perjalanan…</Empty>
            ) : !day || day.points.length === 0 ? (
                <Empty>Tidak ada data posisi pada tanggal ini.</Empty>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <Stat label="Jarak" value={fmtKm(day.distance)} unit="km" big />
                        <Stat label="Waktu jalan" value={fmtDuration(day.movingMs)} big />
                        <Stat
                            label="Berhenti"
                            value={fmtDuration(day.stoppedMs)}
                            sub={
                                day.idleMs > 0
                                    ? `${fmtDuration(day.idleMs)} mesin menyala`
                                    : undefined
                            }
                        />
                        <Stat label="Kec. maks" value={String(day.maxSpeed)} unit="km/jam" />
                        <Stat label="Rata-rata" value={fmtNum(day.avgSpeed)} unit="km/jam" />
                        <Stat
                            label="Perjalanan"
                            value={`${day.trips}`}
                            sub={`${day.stops} kali berhenti`}
                        />
                    </div>

                    <h4 className="m-0 mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Timeline
                    </h4>
                    <ol className="m-0 flex list-none flex-col p-0">
                        {rows.map(({ seg, i, stopNo: no }) => {
                            const on = focus === i;
                            return (
                                <li
                                    key={`${seg.start}-${seg.type}`}
                                    className="relative pl-7 before:absolute before:bottom-0 before:left-[9px] before:top-0 before:w-px before:bg-border last:before:bottom-1/2 first:before:top-1/2"
                                >
                                    <button
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => onFocus(on ? null : i)}
                                        className={cn(
                                            'flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted',
                                            on && 'bg-info-soft',
                                        )}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'absolute left-0 top-1/2 grid size-[19px] -translate-y-1/2 place-items-center rounded-full border-2 border-card font-mono text-[10px] font-bold text-white',
                                                seg.type === 'trip'
                                                    ? 'bg-info'
                                                    : seg.idle
                                                      ? 'bg-warning'
                                                      : 'bg-muted-foreground',
                                            )}
                                        >
                                            {seg.type === 'stop' ? no : ''}
                                        </span>
                                        <span className="flex items-baseline justify-between gap-2">
                                            <b className="text-[13px]">{segTitle(seg)}</b>
                                            <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">
                                                {fmtHm(seg.start)}–{fmtHm(seg.end)}
                                            </span>
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {segSub(seg, day?.fuelUnit ?? null)}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </>
            )}
        </section>
    );
}

function segTitle(seg: TripSegment): string {
    if (seg.type === 'trip') return `Jalan ${fmtKm(seg.distance)} km`;
    return seg.idle ? 'Berhenti, mesin menyala' : 'Berhenti';
}

function segSub(seg: TripSegment, fuelUnit: 'L' | '%' | null): string {
    const fuel =
        seg.fuelUsed != null && seg.fuelUsed > 0 && fuelUnit
            ? ` · BBM −${fmtNum(seg.fuelUsed, 1)} ${fuelUnit}`
            : '';
    const dur = fmtDuration(seg.end - seg.start);
    if (seg.type === 'trip')
        return `${dur} · maks ${seg.maxSpeed} km/jam${fuel}${seg.place ? ` · ke ${seg.place}` : ''}`;
    return `${dur}${seg.place ? ` · ${seg.place}` : ''}`;
}

// Status kerja unit (Bertugas / Menyelesaikan ritase / Selesai / Tidak bertugas).
function WorkBadge({ imei, job }: { imei: string; job: Duty | undefined }) {
    const done = useDone().get(imei);
    const w = workState(job, done);
    return <Badge variant={w.variant}>{w.label}</Badge>;
}

// Unit tanpa tugas: "Selesai · shift X" bila shift-nya baru selesai, selain itu "Tidak bertugas".
function IdleText({ imei, long = false }: { imei: string; long?: boolean }) {
    const done = useDone().get(imei);
    if (!done) return <span className="text-muted-foreground">Tidak bertugas</span>;
    const at = done.closedAt
        ? new Date(done.closedAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';
    return (
        <span>
            {long
                ? `Selesai · ${done.shiftName} (${done.routeName}${at ? `, selesai ${at}` : ''})`
                : `Selesai · ${done.shiftName}`}
        </span>
    );
}
