'use client';
// Titik & rute.
//   Titik : master titik (gudang, pelabuhan, …) — tempat + radius (default 10 m), tanpa jenis.
//   Rute  : pilih titik mana yang menjadi pit dan mana yang menjadi dumping. Satu titik bisa
//           menjadi pit di rute A dan dumping di rute B. Operator & unit masuk ke rute lewat penugasan shift.
// User biasa hanya dapat melihat.
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
    ArrowLeft,
    Layers,
    MapPin,
    MousePointerClick,
    Pencil,
    Plus,
    Route as RouteIcon,
    Trash2,
    Truck,
} from 'lucide-react';
import { ZONE_KIND } from '@/lib/labels';
import SitesMap from '@/components/fleet/SitesMap';
import RoadInfo from '@/components/fleet/RoadInfo';
import type { RoadState } from '@/components/fleet/RoadInfo';
import type { Draft } from '@/components/fleet/SitesMap';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import { useData } from '@/provider/StreamProvider';
import useFetchApi from '@/hooks/react-query/useFetchApi';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import type { GlobalApiResponse } from '@/types/api/responses';
import { truckLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Empty, KV, Note, RoutePair, SiteDot } from '@/components/ui/misc';
import { distanceM } from '@/lib/geo';
import type {
    Device,
    RoadRoute,
    Route,
    RouteHistory,
    Site,
    SiteType,
    SiteZone,
    ZoneKind,
} from '@/types/fleet';

type Tab = 'sites' | 'routes';

interface ZoneEdit {
    siteId: string;
    zones: SiteZone[];
    adding: ZoneKind | null;
    queueAlertTrucks: number;
    queueAlertMin: number;
}

function zoneSummary(s: Site): string {
    const q = (s.zones ?? []).filter((z) => z.kind === 'queue').length;
    const sp = (s.zones ?? []).filter((z) => z.kind === 'spot').length;
    if (!q && !sp) return 'Belum ada (antre = diam sebelum masuk radius)';
    return [q && `${q} antre`, sp && `${sp} spot`].filter(Boolean).join(' · ');
}

interface SiteForm extends Draft {
    note: string;
}

interface RouteForm {
    name: string;
    loadingId: string;
    unloadingId: string; // stockpile / jetty utama
    extraUnloadingIds: string[]; // stockpile / jetty tambahan
    note: string;
}

// Body API rute: semua stockpile / jetty, utama dulu.
type RouteBody = Omit<RouteForm, 'extraUnloadingIds'> & { unloadingIds: string[] };

// Semua stockpile / jetty rute, utama dulu.
const jettiesOf = (r: Route) => r.unloadingIds ?? [r.unloadingId];

const DEFAULT_RADIUS = 10;
const emptySite = (): SiteForm => ({
    name: '',
    lat: null,
    lng: null,
    radius: DEFAULT_RADIUS,
    note: '',
});
const siteFormOf = (s: Site): SiteForm => ({
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    radius: s.radius,
    note: s.note ?? '',
});
const routeFormOf = (r: Route): RouteForm => ({
    name: r.name,
    loadingId: r.loadingId,
    unloadingId: r.unloadingId,
    extraUnloadingIds: jettiesOf(r).slice(1),
    note: r.note ?? '',
});
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function SitesView() {
    const { sites, routes, devices } = useData();
    const { setStats } = useLayout();
    const can = useCan();
    const fetchApi = useFetchApi();
    // Boleh menambah/mengubah titik & rute (permission role, diperiksa ulang di server).
    const isAdmin = can(P.siteCreate) || can(P.siteUpdate);
    const canRoutes = can(P.routeCreate) || can(P.routeUpdate);

    const [tab, setTab] = useState<Tab>('sites');
    const [siteId, setSiteId] = useState<string | null>(null);
    const [routeId, setRouteId] = useState<string | null>(null);
    // Form titik (draft di peta) dan form rute. editing* = id yang diubah, null = membuat baru.
    const [siteForm, setSiteForm] = useState<SiteForm | null>(null);
    const [editingSite, setEditingSite] = useState<string | null>(null);
    const [routeForm, setRouteForm] = useState<RouteForm | null>(null);
    const [editingRoute, setEditingRoute] = useState<string | null>(null);
    // Zona antre & spot titik yang dipilih (adding = jenis zona yang dipasang pada klik peta berikutnya).
    const [zoneEdit, setZoneEdit] = useState<ZoneEdit | null>(null);

    const trucks = useMemo(
        () => Object.values(devices).sort((a, b) => truckLabel(a).localeCompare(truckLabel(b))),
        [devices],
    );
    const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Titik" value={sites.length} />
                <HeaderStat label="Rute" value={routes.length} />
            </>,
        );
    }, [setStats, sites, routes]);
    useEffect(() => () => setStats(null), [setStats]);

    // Yang dipilih dihapus (mis. dari tab lain)
    useEffect(() => {
        if (siteId && !siteById.has(siteId)) setSiteId(null);
        if (routeId && !routes.some((r) => r.id === routeId)) setRouteId(null);
    }, [siteById, routes, siteId, routeId]);

    const closeSite = () => {
        setSiteForm(null);
        setEditingSite(null);
        setZoneEdit(null);
    };
    const closeRoute = () => {
        setRouteForm(null);
        setEditingRoute(null);
    };

    const switchTab = (t: Tab) => {
        closeSite();
        closeRoute();
        setTab(t);
    };

    const startNewSite = () => {
        setTab('sites');
        closeRoute();
        setSiteId(null);
        setEditingSite(null);
        setSiteForm(emptySite());
    };

    // Klik penanda titik di peta
    const selectSite = (id: string) => {
        if (siteForm) closeSite();
        if (routeForm) return; // sedang membuat rute: penanda hanya untuk melihat info
        setTab('sites');
        setSiteId(id);
    };

    // Klik peta / geser penanda: hanya memasang titik saat sedang membuat/mengubah titik (agar tidak terpencet tanpa sengaja).
    const pick = (lat: number, lng: number) => {
        if (isAdmin && zoneEdit?.adding) {
            const zone: SiteZone = {
                kind: zoneEdit.adding,
                lat,
                lng,
                radius: zoneEdit.adding === 'queue' ? 25 : 12,
            };
            setZoneEdit({ ...zoneEdit, zones: [...zoneEdit.zones, zone], adding: null });
            return;
        }
        if (isAdmin && siteForm) setSiteForm({ ...siteForm, lat, lng });
    };

    // Peta: rute yang sedang dipilih/diedit digambar sebagai garis pit → stockpile / jetty.
    const activeRoute = routeForm
        ? { loadingId: routeForm.loadingId, unloadingId: routeForm.unloadingId }
        : tab === 'routes'
          ? (routes.find((r) => r.id === routeId) ?? null)
          : null;
    const lineFrom = activeRoute ? siteById.get(activeRoute.loadingId) : undefined;
    const lineTo = activeRoute ? siteById.get(activeRoute.unloadingId) : undefined;
    const routeLine = lineFrom && lineTo ? { from: lineFrom, to: lineTo } : null;
    // Peran titik di rute yang sedang dipilih/diedit (L/U di penanda peta).
    const roleKey = activeRoute ? `${activeRoute.loadingId}|${activeRoute.unloadingId}` : '';
    const roles = useMemo(() => {
        const m = new Map<string, SiteType>();
        const [l, u] = roleKey.split('|');
        if (l) m.set(l, 'loading');
        if (u) m.set(u, 'unloading');
        return m;
    }, [roleKey]);

    // Jalur jalan rute yang dipilih/diedit (diambil server, di-cache).
    const roadKey =
        lineFrom && lineTo
            ? `${lineFrom.id}|${lineTo.id}|${lineFrom.lat},${lineFrom.lng}|${lineTo.lat},${lineTo.lng}`
            : '';
    const [road, setRoad] = useState<RoadState>({ loading: false, data: null, error: null });
    const [pathIdx, setPathIdx] = useState(0);
    useEffect(() => {
        setPathIdx(0);
        if (!roadKey) {
            setRoad({ loading: false, data: null, error: null });
            return;
        }
        let alive = true;
        const [a, b] = roadKey.split('|');
        setRoad({ loading: true, data: null, error: null });
        fetchApi<RoadRoute>('road', undefined, { from: a, to: b })
            .then((data) => alive && setRoad({ loading: false, data: data ?? null, error: null }))
            .catch(
                (e: unknown) => alive && setRoad({ loading: false, data: null, error: errText(e) }),
            );
        return () => {
            alive = false;
        };
    }, [roadKey, fetchApi]);
    // Jalur return (stockpile / jetty → pit) dihitung terpisah: jalan satu arah bisa berbeda.
    const [roadBack, setRoadBack] = useState<RoadState>({
        loading: false,
        data: null,
        error: null,
    });
    useEffect(() => {
        if (!roadKey) {
            setRoadBack({ loading: false, data: null, error: null });
            return;
        }
        let alive = true;
        const [a, b] = roadKey.split('|');
        setRoadBack({ loading: true, data: null, error: null });
        fetchApi<RoadRoute>('road', undefined, { from: b, to: a })
            .then(
                (data) => alive && setRoadBack({ loading: false, data: data ?? null, error: null }),
            )
            .catch(
                (e: unknown) =>
                    alive && setRoadBack({ loading: false, data: null, error: errText(e) }),
            );
        return () => {
            alive = false;
        };
    }, [roadKey, fetchApi]);
    // Jalur aktual dari ritase unit (hanya rute yang sudah disimpan dan titiknya belum diganti di form).
    const savedRoute = routeForm
        ? routes.find((r) => r.id === editingRoute)
        : tab === 'routes'
          ? routes.find((r) => r.id === routeId)
          : undefined;
    const historyId =
        savedRoute &&
        activeRoute &&
        savedRoute.loadingId === activeRoute.loadingId &&
        savedRoute.unloadingId === activeRoute.unloadingId
            ? savedRoute.id
            : '';
    const historyKey = historyId && savedRoute ? `${historyId}|${savedRoute.updatedAt}` : '';
    const [history, setHistory] = useState<RouteHistory | null>(null);
    useEffect(() => {
        setHistory(null);
        if (!historyKey) return;
        let alive = true;
        fetchApi<RouteHistory>('routes-history', { id: historyKey.split('|')[0] })
            .then((h) => alive && setHistory(h ?? null))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [historyKey, fetchApi]);
    const roadInfo =
        lineFrom && lineTo ? (
            <RoadInfo
                from={lineFrom}
                to={lineTo}
                road={road}
                roadBack={roadBack}
                active={pathIdx}
                onActive={setPathIdx}
                history={history}
            />
        ) : null;

    const placing = isAdmin && (siteForm != null || Boolean(zoneEdit?.adding));
    const tip = zoneEdit
        ? zoneEdit.adding
            ? `Klik peta untuk memasang ${ZONE_KIND[zoneEdit.adding].label.toLowerCase()}`
            : 'Geser penanda A (antre) / S (spot) untuk memindahkan zona'
        : siteForm
          ? siteForm.lat == null
              ? 'Klik peta untuk memasang titik, atau ketik lat/lng'
              : 'Klik peta atau geser penanda untuk memindahkan titik'
          : routeForm
            ? 'Pilih pit & stockpile / jetty di panel kiri'
            : isAdmin
              ? 'Klik penanda/peta untuk melihat info · "+ Titik" untuk menambah titik baru'
              : 'Klik penanda atau peta untuk melihat info';

    return (
        <div className="flex min-h-full flex-col lg:grid lg:h-full lg:grid-cols-[380px_minmax(0,1fr)]">
            <aside
                className="order-2 flex flex-col gap-4 border-t bg-card p-4 lg:order-none lg:overflow-y-auto lg:border-r lg:border-t-0"
                aria-label="Titik lokasi dan rute"
            >
                <Tabs value={tab} onValueChange={(v) => switchTab(v as Tab)}>
                    <TabsList className="w-full">
                        <TabsTrigger value="sites">
                            <MapPin /> Titik{' '}
                            <Badge variant="secondary" className="px-1.5 py-0 tabular-nums">
                                {sites.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="routes">
                            <RouteIcon /> Rute{' '}
                            <Badge variant="secondary" className="px-1.5 py-0 tabular-nums">
                                {routes.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {tab === 'sites' && zoneEdit ? (
                    <ZoneEditor
                        site={siteById.get(zoneEdit.siteId) ?? null}
                        edit={zoneEdit}
                        setEdit={setZoneEdit}
                        onClose={() => setZoneEdit(null)}
                    />
                ) : tab === 'sites' ? (
                    <SitesPanel
                        isAdmin={isAdmin}
                        sites={sites}
                        routes={routes}
                        trucks={trucks}
                        devices={devices}
                        selectedId={siteId}
                        onSelect={setSiteId}
                        form={siteForm}
                        setForm={setSiteForm}
                        editingId={editingSite}
                        onNew={startNewSite}
                        onEdit={(s) => {
                            setSiteId(s.id);
                            setEditingSite(s.id);
                            setSiteForm(siteFormOf(s));
                        }}
                        onZones={(s) => {
                            setSiteId(s.id);
                            setZoneEdit({
                                siteId: s.id,
                                zones: (s.zones ?? []).map((z) => ({ ...z })),
                                adding: null,
                                queueAlertTrucks: s.queueAlertTrucks ?? 3,
                                queueAlertMin: s.queueAlertMin ?? 15,
                            });
                        }}
                        onClose={closeSite}
                        onSaved={(s) => {
                            setSiteId(s.id);
                            closeSite();
                        }}
                    />
                ) : (
                    <RoutesPanel
                        isAdmin={canRoutes}
                        siteById={siteById}
                        sites={sites}
                        routes={routes}
                        devices={devices}
                        selectedId={routeId}
                        onSelect={setRouteId}
                        form={routeForm}
                        setForm={setRouteForm}
                        editingId={editingRoute}
                        onNew={() => {
                            setRouteId(null);
                            setEditingRoute(null);
                            setRouteForm({
                                name: '',
                                loadingId: '',
                                unloadingId: '',
                                extraUnloadingIds: [],
                                note: '',
                            });
                        }}
                        onEdit={(r) => {
                            setRouteId(r.id);
                            setEditingRoute(r.id);
                            setRouteForm(routeFormOf(r));
                        }}
                        onClose={closeRoute}
                        onSaved={(r) => {
                            setRouteId(r.id);
                            closeRoute();
                        }}
                        onGoSites={() => switchTab('sites')}
                        roadInfo={roadInfo}
                    />
                )}
            </aside>

            <section className="relative order-1 h-[58dvh] min-h-[340px] p-2 lg:order-none lg:h-auto lg:p-3">
                <div
                    className={cn(
                        'isolate h-full overflow-hidden rounded-2xl border',
                        placing && 'ring-3 ring-brand [&_.leaflet-container]:cursor-crosshair',
                    )}
                >
                    <SitesMap
                        sites={sites}
                        devices={trucks}
                        selectedId={tab === 'sites' ? siteId : null}
                        draft={siteForm}
                        editingId={editingSite}
                        routeLine={routeLine}
                        roles={roles}
                        roadPaths={road.data?.paths.map((x) => x.coords) ?? null}
                        activePath={pathIdx}
                        actualPath={history?.paths?.go?.coords ?? history?.latest?.coords ?? null}
                        backPath={history?.paths?.back?.coords ?? null}
                        roadBackPath={roadBack.data?.paths[0]?.coords ?? null}
                        onPathClick={setPathIdx}
                        onSelect={selectSite}
                        onPick={pick}
                        canEdit={placing}
                        zoneEdit={zoneEdit}
                        onZoneMove={(i, lat, lng) =>
                            zoneEdit &&
                            setZoneEdit({
                                ...zoneEdit,
                                zones: zoneEdit.zones.map((z, k) =>
                                    k === i ? { ...z, lat, lng } : z,
                                ),
                            })
                        }
                    />
                </div>
                <div className="pointer-events-none absolute bottom-6 left-1/2 z-[1000] flex max-w-[calc(100%-3rem)] -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs text-muted-foreground shadow-lg max-sm:hidden">
                    <MousePointerClick className="size-3.5 shrink-0" />{' '}
                    <span className="truncate">{tip}</span>
                </div>
            </section>
        </div>
    );
}

// ---------- Tab Titik ----------
interface SitesPanelProps {
    isAdmin: boolean;
    sites: Site[];
    routes: Route[];
    trucks: Device[];
    devices: Record<string, Device>;
    selectedId: string | null;
    onSelect: (id: string) => void;
    form: SiteForm | null;
    setForm: (f: SiteForm | null) => void;
    editingId: string | null;
    onNew: () => void;
    onEdit: (s: Site) => void;
    onZones: (s: Site) => void;
    onClose: () => void;
    onSaved: (s: Site) => void;
}

function SitesPanel({
    isAdmin,
    sites,
    routes,
    trucks,
    devices,
    selectedId,
    onSelect,
    form,
    setForm,
    editingId,
    onNew,
    onEdit,
    onZones,
    onClose,
    onSaved,
}: SitesPanelProps) {
    const [q, setQ] = useState('');
    const shown = sites.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
    const selected = sites.find((s) => s.id === selectedId) ?? null;
    const usedBy = (id: string) =>
        routes.filter((r) => r.loadingId === id || jettiesOf(r).includes(id));
    // "pit di 2 rute · dumping di 1 rute"
    const roleText = (id: string) => {
        const l = routes.filter((r) => r.loadingId === id).length;
        const u = routes.filter((r) => jettiesOf(r).includes(id)).length;
        const parts = [l && `pit di ${l} rute`, u && `stockpile / jetty di ${u} rute`].filter(
            Boolean,
        );
        return parts.length ? parts.join(' · ') : 'belum dipakai rute';
    };

    if (form) {
        return (
            <SiteFormView
                form={form}
                setForm={setForm}
                editingId={editingId}
                trucks={trucks}
                devices={devices}
                usedBy={editingId ? usedBy(editingId) : []}
                onClose={onClose}
                onSaved={onSaved}
            />
        );
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <Input
                    className="flex-1"
                    placeholder="Cari titik…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Cari titik"
                />
                {isAdmin && (
                    <Button onClick={onNew}>
                        <Plus /> Titik
                    </Button>
                )}
            </div>
            <Empty className="text-xs">
                Master titik: pit, stockpile, tongkang (jetty), disposal, garasi, dll. Peran pit /
                stockpile / jetty ditentukan di tab Rute.
            </Empty>

            {sites.length === 0 ? (
                <Empty>
                    {isAdmin
                        ? 'Belum ada titik. Tekan "+ Titik", lalu klik peta atau ketik lat/lng.'
                        : 'Belum ada titik. Minta admin untuk menambahkan titik.'}
                </Empty>
            ) : shown.length === 0 ? (
                <Empty>Tidak ada titik yang cocok.</Empty>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {shown.map((s) => {
                        const sel = s.id === selectedId;
                        return (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    aria-pressed={sel}
                                    onClick={() => onSelect(s.id)}
                                    className={cn(
                                        'flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-ring',
                                        sel && 'border-info ring-3 ring-info/15',
                                    )}
                                >
                                    <SiteDot className="size-7" />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <b className="truncate text-sm">{s.name}</b>
                                        <span className="text-xs text-muted-foreground">
                                            radius {s.radius} m · {roleText(s.id)}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {selected && (
                <div className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-3.5">
                    <div className="flex items-center gap-2">
                        <SiteDot />
                        <b className="min-w-0 flex-1 truncate">{selected.name}</b>
                        {isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => onEdit(selected)}>
                                <Pencil /> Ubah
                            </Button>
                        )}
                    </div>
                    <KV
                        rows={[
                            ['Radius', `${selected.radius} m`],
                            [
                                'Koordinat',
                                <span className="font-mono text-xs">
                                    {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
                                </span>,
                            ],
                            ['Zona', zoneSummary(selected)],
                            [
                                'Alert antrean',
                                `≥ ${selected.queueAlertTrucks ?? 3} unit antre > ${selected.queueAlertMin ?? 15} mnt`,
                            ],
                            ...(selected.note
                                ? ([['Catatan', selected.note]] as [string, string][])
                                : []),
                        ]}
                    />
                    {isAdmin && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            onClick={() => onZones(selected)}
                        >
                            <Layers /> Atur zona antre & spot
                        </Button>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">
                            Dipakai di rute
                        </span>
                        {usedBy(selected.id).length ? (
                            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
                                {usedBy(selected.id).map((r) => (
                                    <li key={r.id} className="flex items-center gap-2">
                                        <SiteDot
                                            type={
                                                r.loadingId === selected.id
                                                    ? 'loading'
                                                    : 'unloading'
                                            }
                                            className="size-4 text-[9px]"
                                        />
                                        <span className="truncate">{r.name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <Empty className="text-xs">Belum dipakai rute.</Empty>
                        )}
                    </div>
                </div>
            )}
            {!isAdmin && <Empty className="text-xs">Akun ini hanya dapat melihat titik.</Empty>}
        </>
    );
}

interface SiteFormProps {
    form: SiteForm;
    setForm: (f: SiteForm | null) => void;
    editingId: string | null;
    trucks: Device[];
    devices: Record<string, Device>;
    usedBy: Route[];
    onClose: () => void;
    onSaved: (s: Site) => void;
}

function SiteFormView({
    form,
    setForm,
    editingId,
    trucks,
    devices,
    usedBy,
    onClose,
    onSaved,
}: SiteFormProps) {
    const toast = useToast();
    const can = useCan();
    type Body = SiteForm;
    const create = useMutationApiRequest<GlobalApiResponse<Site>, Body>({
        key: 'sites-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<Site>, Body>({
        key: 'sites-update',
        params: () => ({ id: editingId ?? '' }),
        config: SILENT,
    });
    const del = useMutationApiRequest<GlobalApiResponse<{ id: string }>, void>({
        key: 'sites-delete',
        params: () => ({ id: editingId ?? '' }),
        config: SILENT,
    });
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Teks input lat/lng (boleh belum lengkap saat diketik). Ikut diperbarui bila titik dipindah melalui peta.
    const [coord, setCoord] = useState({ lat: '', lng: '' });
    const [coordError, setCoordError] = useState<string | null>(null);
    const { lat: formLat, lng: formLng } = form;
    useEffect(() => {
        setCoord((c) => {
            const same =
                c.lat !== '' &&
                c.lng !== '' &&
                Number(c.lat) === formLat &&
                Number(c.lng) === formLng;
            if (same) return c;
            return {
                lat: formLat == null ? '' : formLat.toFixed(6),
                lng: formLng == null ? '' : formLng.toFixed(6),
            };
        });
        setCoordError(null);
    }, [formLat, formLng]);

    const set = <K extends keyof SiteForm>(k: K, v: SiteForm[K]) => setForm({ ...form, [k]: v });

    // Ketik lat/lng. Tempel "-6.2, 106.8" (format Google Maps) di kolom mana saja = keduanya terisi.
    const typeCoord = (k: 'lat' | 'lng', text: string) => {
        const pair = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
        const next = pair ? { lat: pair[1], lng: pair[2] } : { ...coord, [k]: text.trim() };
        setCoord(next);
        const lat = Number(next.lat);
        const lng = Number(next.lng);
        if (next.lat === '' || next.lng === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            setCoordError(
                next.lat === '' && next.lng === ''
                    ? null
                    : 'Isi lat dan lng pakai angka, mis. -6.200000 dan 106.816666',
            );
            return;
        }
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            setCoordError('Lat harus −90…90 dan lng −180…180. Kebalik?');
            return;
        }
        setCoordError(null);
        setForm({ ...form, lat, lng });
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (form.lat == null || form.lng == null) {
            toast({
                title: 'Titik belum dipasang',
                body: 'Klik peta, ketik lat/lng, atau pakai posisi unit.',
                level: 'warn',
            });
            return;
        }
        setSaving(true);
        try {
            const body = { ...form, name: form.name.trim() };
            const saved = (
                editingId ? await update.mutateAsync(body) : await create.mutateAsync(body)
            ).data!;
            toast({
                title: editingId ? 'Titik diubah' : 'Titik dibuat',
                body: `${saved.name} · radius ${saved.radius} m`,
            });
            onSaved(saved);
        } catch (err) {
            toast({ title: 'Gagal menyimpan titik', body: errText(err), level: 'crit' });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!editingId) return;
        try {
            await del.mutateAsync();
            toast({ title: 'Titik dihapus', body: form.name, level: 'warn' });
            onClose();
        } catch (err) {
            toast({ title: 'Gagal menghapus', body: errText(err), level: 'crit' });
        }
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
            <FormHead title={editingId ? 'Ubah titik' : 'Titik baru'} onBack={onClose} />

            <Field label="Nama titik">
                <Input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Gudang Cikarang"
                    maxLength={60}
                    required
                    autoComplete="off"
                />
            </Field>

            <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-xl border p-3.5">
                <legend className="px-1 text-[13px] font-medium text-muted-foreground">
                    Posisi
                </legend>
                <Empty className="text-xs">
                    Klik peta, ketik lat/lng, atau tempel "lat, lng" dari Google Maps.
                </Empty>
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Lat">
                        <Input
                            className="font-mono"
                            inputMode="decimal"
                            value={coord.lat}
                            onChange={(e) => typeCoord('lat', e.target.value)}
                            placeholder="-6.200000"
                            autoComplete="off"
                        />
                    </Field>
                    <Field label="Lng">
                        <Input
                            className="font-mono"
                            inputMode="decimal"
                            value={coord.lng}
                            onChange={(e) => typeCoord('lng', e.target.value)}
                            placeholder="106.816666"
                            autoComplete="off"
                        />
                    </Field>
                </div>
                {coordError && <Note>{coordError}</Note>}
                <Combobox
                    value=""
                    onChange={(imei) => {
                        const d = devices[imei];
                        if (d?.pos) setForm({ ...form, lat: d.pos.lat, lng: d.pos.lng });
                    }}
                    options={trucks
                        .filter((d) => d.pos)
                        .map((d) => ({
                            value: d.imei,
                            label: truckLabel(d),
                            hint: d.vehicle ?? undefined,
                        }))}
                    placeholder="Pakai posisi unit sekarang…"
                    searchPlaceholder="Cari plat…"
                    empty="Belum ada unit yang punya posisi."
                    icon={<Truck className="size-4 text-muted-foreground" />}
                    aria-label="Pakai posisi unit sekarang"
                />
            </fieldset>

            <Field label="Radius (meter)">
                <Input
                    type="number"
                    min={5}
                    max={1000}
                    step={1}
                    value={form.radius}
                    onChange={(e) => set('radius', Number(e.target.value))}
                    required
                />
            </Field>
            {form.radius < 15 && (
                <Note>
                    Akurasi GPS 3–10 m. Dengan radius {form.radius} m unit yang sudah berada di
                    dalam terkadang terbaca di luar; perbesar radius bila kunjungan sering terlewat.
                </Note>
            )}

            <Field label="Catatan">
                <Input
                    value={form.note}
                    onChange={(e) => set('note', e.target.value)}
                    placeholder="Opsional, mis. dok 3"
                    maxLength={200}
                    autoComplete="off"
                />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={saving}>
                    {saving ? 'Menyimpan…' : 'Simpan titik'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                    Batal
                </Button>
                {editingId && can(P.siteDelete) && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="ml-auto text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(true)}
                    >
                        <Trash2 /> Hapus
                    </Button>
                )}
            </div>
            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={`Hapus titik ${form.name}?`}
                description={
                    usedBy.length
                        ? `Titik ini dipakai rute ${usedBy.map((r) => r.name).join(', ')}, sehingga tidak dapat dihapus sebelum rutenya diubah.`
                        : 'Titik ini belum dipakai rute.'
                }
                confirmLabel="Hapus"
                destructive
                onConfirm={() => void remove()}
            />
        </form>
    );
}

function FormHead({ title, onBack }: { title: string; onBack: () => void }) {
    return (
        <div className="flex items-center gap-2">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onBack}
                aria-label="Kembali"
            >
                <ArrowLeft />
            </Button>
            <h3 className="m-0 text-base font-semibold">{title}</h3>
        </div>
    );
}

// ---------- Zona antre & spot (P1-5, P1-6) ----------
function ZoneEditor({
    site,
    edit,
    setEdit,
    onClose,
}: {
    site: Site | null;
    edit: ZoneEdit;
    setEdit: (e: ZoneEdit) => void;
    onClose: () => void;
}) {
    const toast = useToast();
    const save = useMutationApiRequest<GlobalApiResponse<Site>, object>({
        key: 'sites-zones',
        params: { id: edit.siteId },
        config: SILENT,
    });
    const setZone = (i: number, z: Partial<SiteZone>) =>
        setEdit({ ...edit, zones: edit.zones.map((x, k) => (k === i ? { ...x, ...z } : x)) });

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            await save.mutateAsync({
                queueAlertTrucks: edit.queueAlertTrucks,
                queueAlertMin: edit.queueAlertMin,
                zones: edit.zones.map(({ kind, lat, lng, radius }) => ({ kind, lat, lng, radius })),
            });
            toast({
                title: 'Zona disimpan',
                body: `${site?.name ?? 'Titik'}: ${edit.zones.length} zona. Ritase berikutnya dihitung pakai zona ini.`,
            });
            onClose();
        } catch (err) {
            toast({ title: 'Gagal menyimpan zona', body: errText(err), level: 'crit' });
        }
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
            <FormHead title={`Zona: ${site?.name ?? ''}`} onBack={onClose} />
            <Note tone="info">
                Pisahkan waktu <b>antre</b> dari <b>muat / dumping</b>. Zona antre = jalur tunggu
                (boleh di luar radius titik). Zona spot = posisi alat muat / dumping. Tanpa zona,
                antre = waktu unit diam tepat sebelum masuk radius.
            </Note>
            <div className="flex gap-2">
                {(['queue', 'spot'] as ZoneKind[]).map((k) => (
                    <Button
                        key={k}
                        type="button"
                        variant={edit.adding === k ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEdit({ ...edit, adding: edit.adding === k ? null : k })}
                    >
                        <Plus /> {ZONE_KIND[k].label}
                    </Button>
                ))}
            </div>
            {edit.adding && (
                <p className="m-0 text-xs text-muted-foreground">
                    Klik peta untuk memasang {ZONE_KIND[edit.adding].label.toLowerCase()}.
                </p>
            )}
            {edit.zones.length === 0 ? (
                <Empty className="text-xs">Belum ada zona.</Empty>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {edit.zones.map((z, i) => (
                        <li key={i} className="flex items-center gap-2 rounded-xl border p-2.5">
                            <i
                                className="size-3 shrink-0 rounded-full"
                                style={{ background: ZONE_KIND[z.kind].color }}
                            />
                            <span className="min-w-0 flex-1">
                                <b className="block text-sm">{ZONE_KIND[z.kind].label}</b>
                                <span className="block font-mono text-[11px] text-muted-foreground">
                                    {z.lat.toFixed(5)}, {z.lng.toFixed(5)}
                                </span>
                            </span>
                            <Input
                                type="number"
                                min={3}
                                max={1000}
                                value={z.radius}
                                onChange={(e) =>
                                    setZone(i, {
                                        radius: Math.max(
                                            3,
                                            Math.min(1000, Number(e.target.value) || 0),
                                        ),
                                    })
                                }
                                className="w-20"
                                aria-label="Radius (m)"
                            />
                            <span className="text-xs text-muted-foreground">m</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Hapus zona"
                                onClick={() =>
                                    setEdit({
                                        ...edit,
                                        zones: edit.zones.filter((_, k) => k !== i),
                                    })
                                }
                            >
                                <Trash2 />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="grid grid-cols-2 gap-3">
                <Field label="Alert: jumlah unit antre" hint="Notifikasi bila mencapai jumlah ini…">
                    <Input
                        type="number"
                        min={1}
                        max={100}
                        value={edit.queueAlertTrucks}
                        onChange={(e) =>
                            setEdit({
                                ...edit,
                                queueAlertTrucks: Math.max(1, Number(e.target.value) || 1),
                            })
                        }
                    />
                </Field>
                <Field label="…antre lebih dari (menit)">
                    <Input
                        type="number"
                        min={1}
                        max={600}
                        value={edit.queueAlertMin}
                        onChange={(e) =>
                            setEdit({
                                ...edit,
                                queueAlertMin: Math.max(1, Number(e.target.value) || 1),
                            })
                        }
                    />
                </Field>
            </div>
            <div className="flex gap-2">
                <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? 'Menyimpan…' : 'Simpan zona'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                    Batal
                </Button>
            </div>
        </form>
    );
}

// ---------- Tab Rute ----------
interface RoutesPanelProps {
    isAdmin: boolean;
    sites: Site[];
    siteById: Map<string, Site>;
    routes: Route[];
    devices: Record<string, Device>;
    selectedId: string | null;
    onSelect: (id: string) => void;
    form: RouteForm | null;
    setForm: (f: RouteForm | null) => void;
    editingId: string | null;
    onNew: () => void;
    onEdit: (r: Route) => void;
    onClose: () => void;
    onSaved: (r: Route) => void;
    onGoSites: () => void;
    roadInfo: ReactNode; // jalur jalan + estimasi rute yang dipilih/diedit
}

function RoutesPanel(p: RoutesPanelProps) {
    const { isAdmin, sites, siteById, routes, devices, selectedId, onSelect, form } = p;
    // Titik mana pun bisa menjadi pit atau dumping; perannya ditentukan di rute.
    const loadings = sites;
    const unloadings = sites;
    const selected = routes.find((r) => r.id === selectedId) ?? null;
    const name = (id: string) => siteById.get(id)?.name ?? '?';

    if (form)
        return <RouteFormView {...p} form={form} loadings={loadings} unloadings={unloadings} />;

    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <Empty className="text-xs">1 rute = pilih 1 titik pit + 1 stockpile / jetty.</Empty>
                {isAdmin && (
                    <Button size="sm" onClick={p.onNew} disabled={sites.length < 2}>
                        <Plus /> Rute
                    </Button>
                )}
            </div>
            {sites.length < 2 && (
                <Note tone="info">
                    Buat minimal 2 titik terlebih dahulu di tab{' '}
                    <button type="button" className="font-semibold underline" onClick={p.onGoSites}>
                        Titik
                    </button>
                    .
                </Note>
            )}

            {routes.length === 0 ? (
                sites.length >= 2 && <Empty>Belum ada rute.</Empty>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {routes.map((r) => {
                        const sel = r.id === selectedId;
                        return (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    aria-pressed={sel}
                                    onClick={() => onSelect(r.id)}
                                    className={cn(
                                        'flex w-full flex-col gap-1.5 rounded-xl border bg-card p-3 text-left transition-colors hover:border-ring',
                                        sel && 'border-info ring-3 ring-info/15',
                                    )}
                                >
                                    <b className="text-sm">{r.name}</b>
                                    <RoutePair
                                        from={name(r.loadingId)}
                                        to={jettiesOf(r).map(name).join(' / ')}
                                        className="text-muted-foreground"
                                    />
                                    <span
                                        className={cn(
                                            'text-xs',
                                            r.onDuty.length
                                                ? 'font-medium text-success'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {r.onDuty.length
                                            ? `${r.onDuty.length} operator sedang bertugas · ${[...new Set(r.onDuty.map((x) => x.shiftName))].join(', ')}`
                                            : 'Tidak ada yang bertugas saat ini'}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {selected && (
                <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-3.5">
                    <div className="flex items-center gap-2">
                        <b className="min-w-0 flex-1 truncate">{selected.name}</b>
                        {isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => p.onEdit(selected)}>
                                <Pencil /> Ubah
                            </Button>
                        )}
                    </div>
                    <KV
                        rows={[
                            ['Pit', name(selected.loadingId)],
                            ['Stockpile / jetty', jettiesOf(selected).map(name).join(' / ')],
                            [
                                'Jarak lurus',
                                siteById.get(selected.loadingId) &&
                                siteById.get(selected.unloadingId)
                                    ? fmtDist(
                                          distanceM(
                                              siteById.get(selected.loadingId)!,
                                              siteById.get(selected.unloadingId)!,
                                          ),
                                      )
                                    : '—',
                            ],
                            ...(selected.note
                                ? ([['Catatan', selected.note]] as [string, string][])
                                : []),
                        ]}
                    />
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">
                            Sedang bertugas
                        </span>
                        {selected.onDuty.length ? (
                            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
                                {selected.onDuty.map((x) => (
                                    <li key={x.imei}>
                                        <b>{x.driverName}</b> ·{' '}
                                        <span className="font-mono text-xs">
                                            {devices[x.imei] ? truckLabel(devices[x.imei]) : x.imei}
                                        </span>{' '}
                                        <span className="text-muted-foreground">
                                            ({x.shiftName})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <Empty className="text-xs">
                                Tidak ada shift aktif di rute ini. Operator &amp; unit dibagi di
                                menu Shift.
                            </Empty>
                        )}
                    </div>
                    {p.roadInfo}
                </div>
            )}
            {!isAdmin && <Empty className="text-xs">Akun ini hanya dapat melihat rute.</Empty>}
        </>
    );
}

function RouteFormView({
    form,
    setForm,
    editingId,
    onClose,
    onSaved,
    loadings,
    unloadings,
    roadInfo,
}: RoutesPanelProps & { form: RouteForm; loadings: Site[]; unloadings: Site[] }) {
    const toast = useToast();
    const can = useCan();
    const create = useMutationApiRequest<GlobalApiResponse<Route>, RouteBody>({
        key: 'routes-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<Route>, RouteBody>({
        key: 'routes-update',
        params: () => ({ id: editingId ?? '' }),
        config: SILENT,
    });
    const del = useMutationApiRequest<GlobalApiResponse<{ id: string }>, void>({
        key: 'routes-delete',
        params: () => ({ id: editingId ?? '' }),
        config: SILENT,
    });
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const set = <K extends keyof RouteForm>(k: K, v: RouteForm[K]) => setForm({ ...form, [k]: v });

    // Nama otomatis "Pit → Dumping" bila belum diisi.
    const autoName = (l: string, u: string) => {
        const a = loadings.find((s) => s.id === l)?.name;
        const b = unloadings.find((s) => s.id === u)?.name;
        return a && b ? `${a} → ${b}` : '';
    };
    const pickSite = (k: 'loadingId' | 'unloadingId', id: string) => {
        const next = { ...form, [k]: id };
        const wasAuto = !form.name || form.name === autoName(form.loadingId, form.unloadingId);
        if (wasAuto) next.name = autoName(next.loadingId, next.unloadingId);
        setForm(next);
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { extraUnloadingIds, ...rest } = form;
            const body = {
                ...rest,
                name: form.name.trim(),
                unloadingIds: [form.unloadingId, ...extraUnloadingIds],
            };
            const saved = (
                editingId ? await update.mutateAsync(body) : await create.mutateAsync(body)
            ).data!;
            toast({
                title: editingId ? 'Rute diubah' : 'Rute dibuat',
                body: editingId
                    ? saved.name
                    : `${saved.name}. Bagi operator & unit ke rute ini di menu Shift.`,
            });
            onSaved(saved);
        } catch (err) {
            toast({ title: 'Gagal menyimpan rute', body: errText(err), level: 'crit' });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!editingId) return;
        try {
            await del.mutateAsync();
            toast({ title: 'Rute dihapus', body: form.name, level: 'warn' });
            onClose();
        } catch (err) {
            toast({ title: 'Gagal menghapus', body: errText(err), level: 'crit' });
        }
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
            <FormHead title={editingId ? 'Ubah rute' : 'Rute baru'} onBack={onClose} />
            <Field
                label={
                    <span className="flex items-center gap-1.5">
                        <SiteDot type="loading" className="size-4 text-[9px]" /> Pit
                    </span>
                }
            >
                <Combobox
                    value={form.loadingId}
                    onChange={(v) => pickSite('loadingId', v)}
                    options={loadings
                        .filter(
                            (s) =>
                                s.id !== form.unloadingId && !form.extraUnloadingIds.includes(s.id),
                        )
                        .map((s) => ({ value: s.id, label: s.name, hint: `${s.radius} m` }))}
                    placeholder="Pilih titik pit…"
                    searchPlaceholder="Cari titik…"
                    aria-label="Pit"
                />
            </Field>
            <Field
                label={
                    <span className="flex items-center gap-1.5">
                        <SiteDot type="unloading" className="size-4 text-[9px]" /> Stockpile / jetty
                    </span>
                }
            >
                <Combobox
                    value={form.unloadingId}
                    onChange={(v) => pickSite('unloadingId', v)}
                    options={unloadings
                        .filter(
                            (s) =>
                                s.id !== form.loadingId && !form.extraUnloadingIds.includes(s.id),
                        )
                        .map((s) => ({ value: s.id, label: s.name, hint: `${s.radius} m` }))}
                    placeholder="Pilih stockpile / jetty…"
                    searchPlaceholder="Cari titik…"
                    aria-label="Stockpile / jetty"
                />
            </Field>
            {form.unloadingId && (
                <Field
                    label="Stockpile / jetty tambahan"
                    hint="Opsional. Ritase terhitung di jetty mana pun; tujuan tiap unit di-set di menu Shift."
                >
                    <div className="flex flex-col gap-2">
                        {form.extraUnloadingIds.map((id) => (
                            <div key={id} className="flex items-center gap-2">
                                <SiteDot type="unloading" className="size-4 text-[9px]" />
                                <span className="min-w-0 flex-1 truncate text-sm">
                                    {unloadings.find((s) => s.id === id)?.name ?? id}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                        set(
                                            'extraUnloadingIds',
                                            form.extraUnloadingIds.filter((x) => x !== id),
                                        )
                                    }
                                    aria-label="Hapus stockpile / jetty tambahan"
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        ))}
                        <Combobox
                            value=""
                            onChange={(v) =>
                                v && set('extraUnloadingIds', [...form.extraUnloadingIds, v])
                            }
                            options={unloadings
                                .filter(
                                    (s) =>
                                        s.id !== form.loadingId &&
                                        s.id !== form.unloadingId &&
                                        !form.extraUnloadingIds.includes(s.id),
                                )
                                .map((s) => ({
                                    value: s.id,
                                    label: s.name,
                                    hint: `${s.radius} m`,
                                }))}
                            placeholder="Tambah stockpile / jetty…"
                            searchPlaceholder="Cari titik…"
                            aria-label="Tambah stockpile / jetty"
                        />
                    </div>
                </Field>
            )}
            {roadInfo}
            <Field label="Nama rute">
                <Input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Cikarang → Priok"
                    maxLength={60}
                    required
                    autoComplete="off"
                />
            </Field>
            <Note tone="info">
                Operator &amp; unit tidak dipasang di sini, tetapi dibagi per shift di menu Shift.
            </Note>
            <Field label="Catatan">
                <Textarea
                    value={form.note}
                    onChange={(e) => set('note', e.target.value)}
                    placeholder="Opsional"
                    maxLength={200}
                />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={saving || !form.loadingId || !form.unloadingId}>
                    {saving ? 'Menyimpan…' : 'Simpan rute'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                    Batal
                </Button>
                {editingId && can(P.routeDelete) && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="ml-auto text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(true)}
                    >
                        <Trash2 /> Hapus
                    </Button>
                )}
            </div>
            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={`Hapus rute ${form.name}?`}
                description="Rute yang sudah pernah dipakai shift tidak dapat dihapus."
                confirmLabel="Hapus"
                destructive
                onConfirm={() => void remove()}
            />
        </form>
    );
}
