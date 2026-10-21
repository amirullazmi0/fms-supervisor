'use client';
// Peta zona batas kecepatan (P3-3): lingkaran tiap zona + batasnya, titik front / dumping sebagai
// patokan, dan draft zona yang sedang diisi. Klik peta = pilih titik tengah zona.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBasemap } from '@/lib/basemap';
import { drawSites, escHtml } from '@/lib/siteLayer';
import type { Site, SpeedZone } from '@/types/fleet';

export const ZONE_KIND: Record<SpeedZone['kind'], { label: string; color: string }> = {
    downhill: { label: 'Turunan', color: '#dc2626' },
    crossing: { label: 'Crossing / persimpangan', color: '#f59e0b' },
    barge: { label: 'Area tongkang', color: '#2563eb' },
    other: { label: 'Lainnya', color: '#6b7280' },
};

export default function SpeedZoneMap({
    zones,
    sites,
    draft,
    onPick,
    onSelect,
}: {
    zones: SpeedZone[];
    sites: Site[];
    draft: { lat: number; lng: number; radius: number } | null;
    onPick: (lat: number, lng: number) => void;
    onSelect: (z: SpeedZone) => void;
}) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const zoneLayer = useRef<L.LayerGroup | null>(null);
    const siteLayer = useRef<L.LayerGroup | null>(null);
    const draftLayer = useRef<L.LayerGroup | null>(null);
    const cb = useRef({ onPick, onSelect });
    useEffect(() => {
        cb.current = { onPick, onSelect };
    }, [onPick, onSelect]);
    const fitted = useRef(false);

    useEffect(() => {
        const m = L.map(el.current!, { zoomControl: true }).setView([-6.2, 106.83], 12);
        addBasemap(m);
        siteLayer.current = L.layerGroup().addTo(m);
        zoneLayer.current = L.layerGroup().addTo(m);
        draftLayer.current = L.layerGroup().addTo(m);
        m.on('click', (e: L.LeafletMouseEvent) => cb.current.onPick(e.latlng.lat, e.latlng.lng));
        map.current = m;
        return () => {
            m.remove();
            map.current = null;
        };
    }, []);

    useEffect(() => {
        const g = zoneLayer.current;
        if (!g) return;
        g.clearLayers();
        for (const z of zones) {
            const k = ZONE_KIND[z.kind];
            L.circle([z.lat, z.lng], {
                radius: z.radius,
                color: k.color,
                weight: 2,
                dashArray: z.active ? undefined : '6 6',
                fillOpacity: z.active ? 0.18 : 0.05,
            })
                .bindTooltip(
                    `<b>${escHtml(z.name)}</b> · ${k.label}<br>Batas ${z.limitKmh} km/jam · r ${z.radius} m${z.active ? '' : ' · nonaktif'}`,
                )
                .on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    cb.current.onSelect(z);
                })
                .addTo(g);
            L.marker([z.lat, z.lng], {
                interactive: false,
                icon: L.divIcon({
                    className: '',
                    html: `<div style="background:#fff;border:3px solid ${k.color};border-radius:9999px;width:34px;height:34px;display:grid;place-items:center;font:700 12px system-ui">${z.limitKmh}</div>`,
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                }),
            }).addTo(g);
        }
        const m = map.current;
        if (m && !fitted.current && (zones.length > 0 || sites.length > 0)) {
            fitted.current = true;
            const pts = [...zones, ...sites].map((x) => [x.lat, x.lng] as [number, number]);
            m.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 15 });
        }
    }, [zones, sites]);

    useEffect(() => {
        if (siteLayer.current) drawSites(siteLayer.current, sites);
    }, [sites]);

    useEffect(() => {
        const g = draftLayer.current;
        if (!g) return;
        g.clearLayers();
        if (draft) {
            L.circle([draft.lat, draft.lng], {
                radius: draft.radius,
                color: '#111827',
                weight: 2,
                dashArray: '4 4',
                fillOpacity: 0.1,
            }).addTo(g);
        }
    }, [draft]);

    return <div ref={el} className="h-full min-h-[360px] w-full rounded-xl border" />;
}
