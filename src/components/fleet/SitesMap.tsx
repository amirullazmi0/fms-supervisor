'use client';
// Peta halaman Pit, stockpile / jetty & rute: semua titik, posisi unit, titik yang sedang diedit, dan rute yang dipilih.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { TRUCK_GLYPH } from '@/lib/markers';
import { addBasemap } from '@/lib/basemap';
import 'leaflet/dist/leaflet.css';
import { STATUS_LABEL, ago, lastHeard, statusOf, truckLabel } from '@/lib/format';
import { useDuty } from '@/lib/duty';
import type { Duty } from '@/lib/duty';
import { distanceM } from '@/lib/geo';
import { drawSites, escHtml, siteCircle, siteIcon } from '@/lib/siteLayer';
import { ZONE_KIND } from '@/lib/labels';
import type { Device, Site, SiteType, SiteZone } from '@/types/fleet';

export interface Draft {
    name: string;
    lat: number | null;
    lng: number | null;
    radius: number;
}

interface Props {
    sites: Site[];
    devices: Device[];
    selectedId: string | null;
    draft: Draft | null; // titik yang sedang dibuat/diubah (hanya admin)
    editingId: string | null; // id titik yang sedang diubah (disembunyikan dari layer biasa)
    onSelect: (id: string) => void;
    onPick: (lat: number, lng: number) => void; // klik peta / geser penanda
    canEdit: boolean; // true = sedang memasang/memindahkan titik. false = klik peta hanya menampilkan info koordinat
    routeLine: { from: Site; to: Site } | null; // rute yang sedang dipilih: garis pit -> dumping
    roles?: Map<string, SiteType>; // peran titik di rute yang sedang dipilih (L/U di penanda)
    roadPaths: [number, number][][] | null; // jalur jalan (dari OSRM). null = garis lurus saja
    activePath: number;
    onPathClick: (i: number) => void;
    actualPath: [number, number][] | null; // jalan pergi yang biasa dilalui (jejak GPS ritase)
    backPath?: [number, number][] | null; // jalan return yang biasa dilalui
    roadBackPath?: [number, number][] | null; // jalur jalan return (stockpile / jetty → pit) dari routing
    zoneEdit?: { siteId: string; zones: SiteZone[] } | null; // zona antre/spot yang sedang diedit (bisa digeser)
    onZoneMove?: (i: number, lat: number, lng: number) => void;
    className?: string;
}

// Zona antre / spot: lingkaran putus-putus, warnanya per jenis.
function zoneCircle(z: SiteZone, editing: boolean): L.Circle {
    const k = ZONE_KIND[z.kind];
    return L.circle([z.lat, z.lng], {
        radius: z.radius,
        color: k.color,
        weight: editing ? 2.5 : 1.5,
        dashArray: '6 5',
        fillColor: k.color,
        fillOpacity: editing ? 0.18 : 0.08,
        interactive: false,
    });
}

const ROUTE_GO = '#16a34a'; // menuju stockpile / jetty (hauling)
const ROUTE_BACK = '#e07b00'; // menuju pit (return)

// Panah arah di sepanjang garis (tiap ±1/6 panjang, minimal 300 m sekali).
function addArrows(g: L.LayerGroup, coords: [number, number][], color: string) {
    if (coords.length < 2) return;
    const seg: number[] = [0];
    for (let i = 1; i < coords.length; i++) {
        seg.push(
            seg[i - 1] +
                distanceM(
                    { lat: coords[i - 1][0], lng: coords[i - 1][1] },
                    { lat: coords[i][0], lng: coords[i][1] },
                ),
        );
    }
    const total = seg[seg.length - 1];
    if (total < 50) return;
    const step = Math.max(300, total / 6);
    for (let d = step / 2, i = 1; d < total; d += step) {
        while (i < coords.length - 1 && seg[i] < d) i++;
        const [la1, ln1] = coords[i - 1];
        const [la2, ln2] = coords[i];
        const f = seg[i] === seg[i - 1] ? 0 : (d - seg[i - 1]) / (seg[i] - seg[i - 1]);
        const y = Math.sin(((ln2 - ln1) * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180);
        const x =
            Math.cos((la1 * Math.PI) / 180) * Math.sin((la2 * Math.PI) / 180) -
            Math.sin((la1 * Math.PI) / 180) *
                Math.cos((la2 * Math.PI) / 180) *
                Math.cos(((ln2 - ln1) * Math.PI) / 180);
        const bearing = (Math.atan2(y, x) * 180) / Math.PI;
        const icon = L.divIcon({
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            html: `<div class="route-arrow" style="color:${color};transform:rotate(${bearing - 90}deg)">➤</div>`,
        });
        L.marker([la1 + (la2 - la1) * f, ln1 + (ln2 - ln1) * f], {
            icon,
            interactive: false,
            keyboard: false,
        }).addTo(g);
    }
}

const truckDot = L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div class="truck-dot">${TRUCK_GLYPH}</div>`,
});

function truckPopup(d: Device, job: Duty | undefined): string {
    const st = statusOf(d);
    return `<div class="map-pop">
    <div class="mp-title">${escHtml(truckLabel(d))}</div>
    <dl>
      <dt>Status</dt><dd>${STATUS_LABEL[st]}${d.last ? ` · ${d.last.speed} km/jam` : ''}</dd>
      ${job ? `<dt>Operator</dt><dd>${escHtml(job.driverName)} (${escHtml(job.shiftName)})</dd><dt>Rute</dt><dd>${escHtml(job.routeName)}</dd>` : '<dt>Tugas</dt><dd>Tidak bertugas</dd>'}
      <dt>Update</dt><dd>${ago(lastHeard(d))}</dd>
      <dt>Koordinat</dt><dd class="mono">${d.pos!.lat.toFixed(6)}, ${d.pos!.lng.toFixed(6)}</dd>
    </dl>
  </div>`;
}

export default function SitesMap({
    sites,
    devices,
    selectedId,
    draft,
    editingId,
    onSelect,
    onPick,
    canEdit,
    routeLine,
    roles,
    roadPaths,
    activePath,
    onPathClick,
    actualPath,
    backPath,
    roadBackPath,
    zoneEdit,
    onZoneMove,
    className = 'h-full w-full',
}: Props) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const siteLayer = useRef<L.LayerGroup | null>(null);
    const truckLayer = useRef<L.LayerGroup | null>(null);
    const draftLayer = useRef<L.LayerGroup | null>(null);
    const lineLayer = useRef<L.LayerGroup | null>(null);
    const fitLine = useRef('');
    const fitted = useRef(false);
    const popped = useRef<string | null>(null);
    const trucks = useRef(new Map<string, L.Marker>());
    const zoneLayer = useRef<L.LayerGroup | null>(null);
    const duty = useDuty();
    const cb = useRef({ onSelect, onPick, canEdit, sites, devices, onPathClick, onZoneMove });
    cb.current = { onSelect, onPick, canEdit, sites, devices, onPathClick, onZoneMove };

    useEffect(() => {
        const m = L.map(el.current!, { zoomControl: true }).setView([-6.2, 106.83], 12);
        addBasemap(m);
        truckLayer.current = L.layerGroup().addTo(m);
        lineLayer.current = L.layerGroup().addTo(m);
        zoneLayer.current = L.layerGroup().addTo(m);
        siteLayer.current = L.layerGroup().addTo(m);
        draftLayer.current = L.layerGroup().addTo(m);
        m.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            if (cb.current.canEdit) return cb.current.onPick(lat, lng);
            // Tidak sedang memasang titik: tampilkan koordinat + titik terdekat.
            const near = cb.current.sites
                .map((s) => ({ s, d: distanceM({ lat, lng }, s) }))
                .sort((a, b) => a.d - b.d)[0];
            const nearTxt = near
                ? `<dt>Titik terdekat</dt><dd>${escHtml(near.s.name)} · ${near.d < 1000 ? `${Math.round(near.d)} m` : `${(near.d / 1000).toFixed(1)} km`}</dd>`
                : '';
            L.popup()
                .setLatLng(e.latlng)
                .setContent(
                    `<div class="map-pop"><dl><dt>Koordinat</dt><dd class="mono">${lat.toFixed(6)}, ${lng.toFixed(6)}</dd>${nearTxt}</dl></div>`,
                )
                .openOn(m);
        });
        map.current = m;
        const ro = new ResizeObserver(() => m.invalidateSize());
        ro.observe(el.current!);
        return () => {
            ro.disconnect();
            m.remove();
            trucks.current.clear();
            fitted.current = false;
        };
    }, []);

    // Titik tersimpan
    useEffect(() => {
        if (!siteLayer.current) return;
        const name = (imei: string) => {
            const d = cb.current.devices.find((x) => x.imei === imei);
            return d ? truckLabel(d) : imei;
        };
        const markers = drawSites(
            siteLayer.current,
            sites.filter((s) => s.id !== editingId),
            { onClick: (id) => cb.current.onSelect(id), selectedId, truckName: name, roles },
        );
        // Layer digambar ulang = popup ikut hilang, jadi dibuka kembali untuk titik yang baru dipilih.
        if (selectedId && selectedId !== popped.current) markers.get(selectedId)?.openPopup();
        popped.current = selectedId;
    }, [sites, selectedId, editingId, roles]);

    // Posisi unit saat ini (patokan untuk memasang titik). Marker diperbarui, bukan digambar ulang,
    // agar popup yang sedang terbuka tidak tertutup setiap ada data baru.
    useEffect(() => {
        const g = truckLayer.current;
        if (!g) return;
        const alive = new Set<string>();
        for (const d of devices) {
            if (!d.pos) continue;
            alive.add(d.imei);
            const ll: L.LatLngTuple = [d.pos.lat, d.pos.lng];
            const mk = trucks.current.get(d.imei);
            const html = truckPopup(d, duty.get(d.imei));
            if (mk) mk.setLatLng(ll).setPopupContent(html);
            else
                trucks.current.set(
                    d.imei,
                    L.marker(ll, { icon: truckDot, title: truckLabel(d), zIndexOffset: 300 })
                        .bindPopup(html, { maxWidth: 240 })
                        .addTo(g),
                );
        }
        for (const [imei, mk] of trucks.current) {
            if (alive.has(imei)) continue;
            mk.remove();
            trucks.current.delete(imei);
        }
    }, [devices, duty]);

    // Rute yang dipilih: jalan hauling (hijau, menuju stockpile / jetty) & return (oranye, menuju pit),
    // panah = arah jalan. Peta zoom ke rutenya.
    const lineKey = routeLine
        ? `${routeLine.from.id}|${routeLine.to.id}|${routeLine.from.lat},${routeLine.from.lng}|${routeLine.to.lat},${routeLine.to.lng}`
        : '';
    const legend = useRef<L.Control | null>(null);
    useEffect(() => {
        const m = map.current;
        const g = lineLayer.current;
        if (!m || !g) return;
        g.clearLayers();
        legend.current?.remove();
        legend.current = null;
        if (!routeLine) return;
        const a: [number, number] = [routeLine.from.lat, routeLine.from.lng];
        const b: [number, number] = [routeLine.to.lat, routeLine.to.lng];

        // Alternatif jalur pergi: abu-abu, klik = pilih.
        roadPaths?.forEach((coords, i) => {
            if (i === (roadPaths[activePath] ? activePath : 0)) return;
            L.polyline(coords, { color: '#6b7280', weight: 5, opacity: 0.5 })
                .on('click', () => cb.current.onPathClick(i))
                .bindTooltip(`Alternatif jalur pergi ${i}`, { sticky: true })
                .addTo(g);
        });

        // Jejak aktual unit (biasa dilalui) diutamakan; bila belum ada = jalur dari peta jalan; bila belum ada juga = garis lurus.
        const goReal = Boolean(actualPath?.length);
        const go: [number, number][] = actualPath?.length
            ? actualPath
            : roadPaths?.length
              ? (roadPaths[activePath] ?? roadPaths[0])
              : [a, b];
        const backReal = Boolean(backPath?.length);
        const back: [number, number][] | null = backPath?.length
            ? backPath
            : roadBackPath?.length
              ? roadBackPath
              : null;
        const goStraight = !goReal && !roadPaths?.length;

        // Return di bawah (lebih tebal), hauling di atas: pada jalan yang sama keduanya tetap terlihat.
        if (back) {
            L.polyline(back, {
                color: '#ffffff',
                weight: 13,
                opacity: 0.9,
                interactive: false,
            }).addTo(g);
            L.polyline(back, { color: ROUTE_BACK, weight: 9, opacity: 0.9 })
                .bindTooltip(
                    `Menuju pit (return) · ${backReal ? 'jalan yang biasa dilalui unit' : 'jalur dari peta jalan'}`,
                    { sticky: true },
                )
                .addTo(g);
        }
        if (!back)
            L.polyline(go, { color: '#ffffff', weight: 9, opacity: 0.9, interactive: false }).addTo(
                g,
            );
        L.polyline(go, {
            color: ROUTE_GO,
            weight: back ? 4 : 5,
            opacity: 0.95,
            ...(goStraight ? { dashArray: '8 8' } : {}),
        })
            .bindTooltip(
                `Menuju stockpile / jetty (pergi) · ${goReal ? 'jalan yang biasa dilalui unit' : goStraight ? 'garis lurus (jalur jalan belum ada)' : 'jalur dari peta jalan'}`,
                { sticky: true },
            )
            .addTo(g);
        if (back) addArrows(g, back, ROUTE_BACK);
        addArrows(g, go, ROUTE_GO);

        const ctl = new L.Control({ position: 'bottomleft' });
        ctl.onAdd = () => {
            const el = L.DomUtil.create('div', 'route-legend');
            el.innerHTML = `
        <div><i style="background:${ROUTE_GO}"></i><b>Menuju stockpile / jetty</b> (pergi) <small>${escHtml(routeLine.from.name)} → ${escHtml(routeLine.to.name)}</small></div>
        ${back ? `<div><i style="background:${ROUTE_BACK}"></i><b>Menuju pit</b> (return) <small>${escHtml(routeLine.to.name)} → ${escHtml(routeLine.from.name)}</small></div>` : ''}
        <div class="muted">${goReal || backReal ? 'Garis = jalan yang biasa dilalui unit (dari ritase).' : 'Garis = jalur dari peta jalan, belum ada ritase.'} Panah = arah.</div>`;
            L.DomEvent.disableClickPropagation(el);
            return el;
        };
        ctl.addTo(m);
        legend.current = ctl;

        const fitKey = `${lineKey}|${roadPaths?.length ?? 0}|${actualPath?.length ?? 0}|${backPath?.length ?? 0}|${roadBackPath?.length ?? 0}`;
        if (fitLine.current !== fitKey) {
            fitLine.current = fitKey;
            const all: L.LatLngTuple[] = [
                a,
                b,
                ...(roadPaths?.flat() ?? []),
                ...(actualPath ?? []),
                ...(backPath ?? []),
                ...(roadBackPath ?? []),
            ];
            m.fitBounds(L.latLngBounds(all), { padding: [60, 60], maxZoom: 17 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lineKey, roadPaths, activePath, actualPath, backPath, roadBackPath]);

    // Titik yang sedang diedit: penanda bisa digeser
    useEffect(() => {
        const g = draftLayer.current;
        if (!g) return;
        g.clearLayers();
        if (!draft || draft.lat == null || draft.lng == null) return;
        siteCircle({ lat: draft.lat, lng: draft.lng, radius: draft.radius }, null, true).addTo(g);
        const mk = L.marker([draft.lat, draft.lng], {
            icon: siteIcon(draft.name || 'Titik baru', null, true),
            draggable: true,
            zIndexOffset: 1000,
        });
        mk.bindTooltip(
            `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)} · radius ${draft.radius} m`,
            { direction: 'top', offset: [0, -14] },
        );
        mk.on('dragend', () => {
            const ll = mk.getLatLng();
            cb.current.onPick(ll.lat, ll.lng);
        });
        mk.addTo(g);
        // Mis. setelah "pakai posisi unit": bila titiknya di luar layar, peta ikut bergeser.
        const m = map.current;
        if (m && !m.getBounds().contains([draft.lat, draft.lng]))
            m.setView([draft.lat, draft.lng], Math.max(m.getZoom(), 17));
    }, [draft]);

    // Zona antre & spot: yang tersimpan (tipis) untuk semua titik, yang sedang diedit bisa digeser.
    useEffect(() => {
        const g = zoneLayer.current;
        if (!g) return;
        g.clearLayers();
        for (const s of sites) {
            if (s.id === zoneEdit?.siteId) continue;
            (s.zones ?? []).forEach((z) => zoneCircle(z, false).addTo(g));
        }
        zoneEdit?.zones.forEach((z, i) => {
            zoneCircle(z, true).addTo(g);
            const k = ZONE_KIND[z.kind];
            const icon = L.divIcon({
                className: '',
                iconSize: [22, 22],
                iconAnchor: [11, 11],
                html: `<div style="width:22px;height:22px;border-radius:50%;background:${k.color};border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.4);color:#fff;font:600 11px/18px sans-serif;text-align:center">${z.kind === 'queue' ? 'A' : 'S'}</div>`,
            });
            const mk = L.marker([z.lat, z.lng], { icon, draggable: true, zIndexOffset: 1200 });
            mk.bindTooltip(`${k.label} · radius ${z.radius} m (geser untuk memindahkan)`, {
                direction: 'top',
                offset: [0, -12],
            });
            mk.on('dragend', () => {
                const ll = mk.getLatLng();
                cb.current.onZoneMove?.(i, ll.lat, ll.lng);
            });
            mk.addTo(g);
        });
    }, [sites, zoneEdit]);

    // Zoom awal: ke semua titik, bila belum ada ke posisi unit.
    useEffect(() => {
        const m = map.current;
        if (!m || fitted.current) return;
        const pts: L.LatLngTuple[] = sites.length
            ? sites.map((s) => [s.lat, s.lng])
            : devices.filter((d) => d.pos).map((d) => [d.pos!.lat, d.pos!.lng]);
        if (!pts.length) return;
        fitted.current = true;
        if (pts.length === 1) m.setView(pts[0], 17);
        else m.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 17 });
    }, [sites, devices]);

    // Titik dipilih dari daftar: geser peta ke sana.
    useEffect(() => {
        const m = map.current;
        const s = sites.find((x) => x.id === selectedId);
        if (m && s) m.setView([s.lat, s.lng], Math.max(m.getZoom(), 18));
        // hanya saat pilihan berubah
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    return <div ref={el} className={className} aria-label="Peta titik lokasi" />;
}
