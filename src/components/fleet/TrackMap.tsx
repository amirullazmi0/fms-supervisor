'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    STATUS_LABEL,
    ago,
    fmtDuration,
    fmtHm,
    fmtKm,
    fmtNum,
    lastHeard,
    statusOf,
    truckLabel,
} from '@/lib/format';
import { drawSites, escHtml as esc } from '@/lib/siteLayer';
import { addBasemap } from '@/lib/basemap';
import { ROUTE_COLOR, playIcon, truckIcon } from '@/lib/markers';
import type { Basemap } from '@/lib/basemap';
import { useDuty } from '@/lib/duty';
import type { Duty } from '@/lib/duty';
import type { DaySummary, Device, Site, SiteType, TrackPoint } from '@/types/fleet';

const stopIcon = (n: number, idle: boolean) =>
    L.divIcon({
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<div class="stop-mk${idle ? ' idle' : ''}">${n}</div>`,
    });
const startIcon = L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: '<div class="stop-mk start">A</div>',
});

const pop = (title: string, rows: [string, string][]) =>
    `<div class="map-pop"><div class="mp-title">${esc(title)}</div><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;

function truckPopup(d: Device, job: Duty | undefined): string {
    const rows: [string, string][] = [
        ['Status', `${STATUS_LABEL[statusOf(d)]}${d.last ? ` · ${d.last.speed} km/jam` : ''}`],
    ];
    rows.push(
        job
            ? ['Supir', `${esc(job.driverName)} <span class="muted">(${esc(job.shiftName)})</span>`]
            : ['Tugas', 'Nganggur'],
    );
    if (job) rows.push(['Rute', esc(job.routeName)]);
    rows.push(['Update', ago(lastHeard(d))]);
    if (d.pos)
        rows.push([
            'Koordinat',
            `<span class="mono">${d.pos.lat.toFixed(6)}, ${d.pos.lng.toFixed(6)}</span>`,
        ]);
    return pop(truckLabel(d), rows);
}

interface Props {
    devices: Device[];
    selected: string | null;
    onSelect: (imei: string) => void;
    day: DaySummary | null;
    focus: number | null; // index segmen yang lagi disorot
    playhead: TrackPoint | null;
    follow: boolean;
    fitKey: string; // berubah = peta di-zoom ulang ke rute (ganti truk / ganti tanggal)
    sites: Site[]; // titik loading/unloading truk yang dipilih
    siteRoles: Map<string, SiteType>; // peran tiap titik di rute truk
    routeLines: { id: string; name: string; coords: [number, number][]; actual: boolean }[]; // jalur rute truk
    highlight: { start: number; end: number } | null; // ritase yang lagi disorot
    basemap: Basemap; // peta / satelit
    showRoutes: boolean; // lapisan titik & jalur rute
    className?: string;
}

export default function TrackMap({
    devices,
    selected,
    onSelect,
    day,
    focus,
    playhead,
    follow,
    fitKey,
    sites,
    siteRoles,
    highlight,
    routeLines,
    basemap,
    showRoutes,
    className = 'h-full w-full',
}: Props) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const markers = useRef(new Map<string, L.Marker>());
    const route = useRef<L.LayerGroup | null>(null);
    const siteLayer = useRef<L.LayerGroup | null>(null);
    const lineLayer = useRef<L.LayerGroup | null>(null);
    const hlLayer = useRef<L.LayerGroup | null>(null);
    const hlFitted = useRef('');
    const openSeg = useRef<string | null>(null); // popup segmen yang lagi kebuka, dibuka lagi setelah rute digambar ulang
    const play = useRef<L.Marker | null>(null);
    const setBase = useRef<((b: Basemap) => void) | null>(null);
    const fitted = useRef('');
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const devicesRef = useRef(devices);
    devicesRef.current = devices;
    const duty = useDuty();
    const dutyRef = useRef(duty);
    dutyRef.current = duty;

    useEffect(() => {
        const m = L.map(el.current!, { zoomControl: false }).setView([-6.2, 106.83], 12);
        L.control.zoom({ position: 'bottomright' }).addTo(m);
        setBase.current = addBasemap(m, basemap);
        lineLayer.current = L.layerGroup().addTo(m);
        siteLayer.current = L.layerGroup().addTo(m);
        route.current = L.layerGroup().addTo(m);
        hlLayer.current = L.layerGroup().addTo(m);
        map.current = m;
        const ro = new ResizeObserver(() => m.invalidateSize());
        ro.observe(el.current!);
        const mk = markers.current;
        return () => {
            ro.disconnect();
            m.remove();
            mk.clear();
            play.current = null;
            fitted.current = '';
        };
    }, []);

    useEffect(() => setBase.current?.(basemap), [basemap]);

    // Lapisan titik & jalur rute bisa disembunyiin (tombol Lapisan).
    useEffect(() => {
        const m = map.current;
        if (!m) return;
        for (const g of [siteLayer.current, lineLayer.current]) {
            if (!g) continue;
            if (showRoutes) g.addTo(m);
            else g.remove();
        }
    }, [showRoutes]);

    // Marker truk
    useEffect(() => {
        const m = map.current;
        if (!m) return;
        const alive = new Set(devices.map((d) => d.imei));
        for (const [imei, mk] of markers.current) {
            if (!alive.has(imei)) {
                mk.remove();
                markers.current.delete(imei);
            }
        }
        for (const d of devices) {
            if (!d.pos) continue;
            const ll: L.LatLngTuple = [d.pos.lat, d.pos.lng];
            let mk = markers.current.get(d.imei);
            if (mk) mk.setLatLng(ll);
            else {
                mk = L.marker(ll, { title: truckLabel(d) })
                    .bindPopup(truckPopup(d, dutyRef.current.get(d.imei)), { maxWidth: 240 })
                    .addTo(m);
                mk.on('click', () => onSelectRef.current(d.imei));
                markers.current.set(d.imei, mk);
            }
            mk.setPopupContent(truckPopup(d, dutyRef.current.get(d.imei)));
            mk.setIcon(truckIcon(d, truckLabel(d), d.imei === selected));
            mk.setZIndexOffset(d.imei === selected ? 1000 : 0);
        }
    }, [devices, selected]);

    // Rute hari itu: garis perjalanan + titik berhenti
    useEffect(() => {
        const m = map.current;
        const g = route.current;
        if (!m || !g) return;
        const keep = openSeg.current; // dibaca sebelum clearLayers (yang nutup popup)
        g.clearLayers();
        openSeg.current = keep;
        if (!day || day.points.length === 0) return;

        const accent = ROUTE_COLOR;
        const all = day.points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
        L.polyline(all, { color: '#5b6b67', weight: 2, opacity: 0.35, dashArray: '4 6' }).addTo(g);

        let stopNo = 0;
        let reopen: L.Layer | null = null;
        const track = (layer: L.Layer, key: string) => {
            layer.on('popupopen', () => (openSeg.current = key));
            layer.on('popupclose', () => {
                if (openSeg.current === key) openSeg.current = null;
            });
            if (key === keep) reopen = layer;
            return layer;
        };
        day.segments.forEach((seg, i) => {
            const key = `${seg.type}-${seg.start}`;
            const pts = day.points
                .slice(seg.fromIndex, seg.toIndex + 1)
                .map((p) => [p.lat, p.lng] as L.LatLngTuple);
            if (seg.type === 'trip') {
                const hot = focus === i;
                const fuel =
                    seg.fuelUsed != null && day.fuelUnit
                        ? [
                              ['BBM', `${fmtNum(seg.fuelUsed, 1)} ${day.fuelUnit}`] as [
                                  string,
                                  string,
                              ],
                          ]
                        : [];
                track(
                    L.polyline(pts, {
                        color: accent,
                        weight: hot ? 7 : 4,
                        opacity: focus == null || hot ? 0.9 : 0.35,
                    }),
                    key,
                )
                    .bindPopup(
                        pop(`Jalan ${fmtKm(seg.distance)} km`, [
                            [
                                'Waktu',
                                `${fmtHm(seg.start)}–${fmtHm(seg.end)} (${fmtDuration(seg.end - seg.start)})`,
                            ],
                            [
                                'Kecepatan',
                                `rata-rata ${fmtNum(seg.avgSpeed)} · maks ${seg.maxSpeed} km/jam`,
                            ],
                            ...fuel,
                            ...(seg.place ? [['Tujuan', esc(seg.place)] as [string, string]] : []),
                        ]),
                    )
                    .addTo(g);
            } else {
                stopNo++;
                track(
                    L.marker([seg.to.lat, seg.to.lng], {
                        icon: stopIcon(stopNo, seg.idle),
                        zIndexOffset: focus === i ? 900 : 100,
                        title: seg.place ?? `Berhenti ${stopNo}`,
                    }),
                    key,
                )
                    .bindPopup(
                        pop(`Berhenti ${stopNo}${seg.idle ? ' (mesin nyala)' : ''}`, [
                            ['Waktu', `${fmtHm(seg.start)}–${fmtHm(seg.end)}`],
                            ['Lama', fmtDuration(seg.end - seg.start)],
                            ...(seg.place ? [['Lokasi', esc(seg.place)] as [string, string]] : []),
                            [
                                'Koordinat',
                                `<span class="mono">${seg.to.lat.toFixed(6)}, ${seg.to.lng.toFixed(6)}</span>`,
                            ],
                        ]),
                    )
                    .addTo(g);
            }
        });
        L.marker(all[0], { icon: startIcon, title: 'Titik awal hari ini', zIndexOffset: 50 })
            .bindPopup(
                pop('Titik awal', [
                    ['Waktu', fmtHm(day.points[0].t)],
                    [
                        'Koordinat',
                        `<span class="mono">${all[0][0].toFixed(6)}, ${all[0][1].toFixed(6)}</span>`,
                    ],
                ]),
            )
            .addTo(g);
        if (reopen) (reopen as L.Layer).openPopup();

        if (fitted.current !== fitKey) {
            fitted.current = fitKey;
            if (all.length === 1) m.setView(all[0], 16);
            else m.fitBounds(L.latLngBounds(all), { padding: [50, 50], maxZoom: 17 });
        }
    }, [day, focus, fitKey]);

    // Titik loading/unloading
    useEffect(() => {
        if (!siteLayer.current) return;
        const name = (imei: string) => {
            const d = devicesRef.current.find((x) => x.imei === imei);
            return d ? truckLabel(d) : imei;
        };
        drawSites(siteLayer.current, sites, { truckName: name, roles: siteRoles });
    }, [sites, siteRoles]);

    // Jalur rute truk (di bawah rute hari ini): hijau = jalan asli ritase terakhir, putus-putus = belum pernah jalan.
    useEffect(() => {
        const g = lineLayer.current;
        if (!g) return;
        g.clearLayers();
        for (const r of routeLines) {
            L.polyline(r.coords, {
                color: '#ffffff',
                weight: 8,
                opacity: 0.7,
                interactive: false,
            }).addTo(g);
            L.polyline(
                r.coords,
                r.actual
                    ? { color: '#16a34a', weight: 4, opacity: 0.75 }
                    : { color: '#7c3aed', weight: 3, opacity: 0.7, dashArray: '8 8' },
            )
                .bindTooltip(
                    `Rute ${r.name}${r.actual ? ' · jalur ritase terakhir' : ' · belum ada ritase'}`,
                    { sticky: true },
                )
                .addTo(g);
        }
    }, [routeLines]);

    // Ritase yang dipilih: rute dari keluar loading sampai tiba di unloading
    useEffect(() => {
        const m = map.current;
        const g = hlLayer.current;
        if (!m || !g) return;
        g.clearLayers();
        if (!highlight || !day) {
            hlFitted.current = '';
            return;
        }
        const pts = day.points
            .filter((p) => p.t >= highlight.start && p.t <= highlight.end)
            .map((p) => [p.lat, p.lng] as L.LatLngTuple);
        if (pts.length < 2) return;
        L.polyline(pts, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(g);
        L.polyline(pts, { color: '#7c3aed', weight: 5, opacity: 0.95 }).addTo(g);
        // Zoom cuma waktu ritase-nya ganti, bukan tiap data baru masuk.
        const key = `${highlight.start}-${highlight.end}`;
        if (hlFitted.current !== key) {
            hlFitted.current = key;
            m.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 17 });
        }
    }, [highlight, day]);

    // Zoom ke segmen yang dipilih di timeline
    useEffect(() => {
        const m = map.current;
        if (!m || focus == null || !day) return;
        const seg = day.segments[focus];
        if (!seg) return;
        const pts = day.points
            .slice(seg.fromIndex, seg.toIndex + 1)
            .map((p) => [p.lat, p.lng] as L.LatLngTuple);
        if (seg.type === 'stop' || pts.length < 2)
            m.setView([seg.to.lat, seg.to.lng], Math.max(m.getZoom(), 17));
        else m.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 17 });
        // cuma saat fokus berubah, bukan tiap data baru
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focus]);

    // Penanda playback
    useEffect(() => {
        const m = map.current;
        if (!m) return;
        if (!playhead) {
            play.current?.remove();
            play.current = null;
            return;
        }
        const ll: L.LatLngTuple = [playhead.lat, playhead.lng];
        if (play.current) play.current.setLatLng(ll).setIcon(playIcon(playhead.angle));
        else
            play.current = L.marker(ll, {
                icon: playIcon(playhead.angle),
                zIndexOffset: 2000,
                interactive: false,
            }).addTo(m);
        if (!m.getBounds().pad(-0.15).contains(ll)) m.panTo(ll, { animate: true });
    }, [playhead]);

    // Ikuti truk yang dipilih (kalau lagi nggak playback)
    const sel = devices.find((d) => d.imei === selected);
    const lat = sel?.pos?.lat;
    const lng = sel?.pos?.lng;
    useEffect(() => {
        if (follow && !playhead && lat != null && lng != null && fitted.current === fitKey)
            map.current?.panTo([lat, lng], { animate: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [follow, lat, lng]);

    return <div ref={el} className={className} aria-label="Peta pelacakan truk" />;
}
