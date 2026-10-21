'use client';
// Peta heat map kecepatan (P3-2): sel jalan ±22 m diwarnai menurut kecepatan rata-rata unit
// (merah = lambat / titik panas, hijau = lancar), titik guncangan akselerometer, dan titik front /
// dumping. Digambar dengan canvas agar ribuan sel tetap ringan.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBasemap } from '@/lib/basemap';
import { drawSites } from '@/lib/siteLayer';
import { fmtNum } from '@/lib/format';
import type { HeatCell, ShockPoint, Site } from '@/types/fleet';

// Batas kecepatan (km/jam) → warna. Urut dari lambat.
export const SPEED_BANDS: { max: number; color: string; label: string }[] = [
    { max: 10, color: '#dc2626', label: '< 10' },
    { max: 20, color: '#f97316', label: '10–20' },
    { max: 30, color: '#eab308', label: '20–30' },
    { max: 40, color: '#84cc16', label: '30–40' },
    { max: Infinity, color: '#16a34a', label: '≥ 40' },
];

export const SHOCK: Record<ShockPoint['kind'], { label: string; color: string }> = {
    brake: { label: 'Rem mendadak', color: '#b91c1c' },
    accel: { label: 'Akselerasi keras', color: '#ea580c' },
    corner: { label: 'Belok tajam', color: '#7c3aed' },
    crash: { label: 'Benturan / tabrakan', color: '#111827' },
};

const colorOf = (kmh: number) => SPEED_BANDS.find((b) => kmh < b.max)!.color;

export default function HeatMap({
    cells,
    cellDeg,
    shocks,
    sites,
}: {
    cells: HeatCell[];
    cellDeg: number;
    shocks: ShockPoint[];
    sites: Site[];
}) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const cellLayer = useRef<L.LayerGroup | null>(null);
    const shockLayer = useRef<L.LayerGroup | null>(null);
    const siteLayer = useRef<L.LayerGroup | null>(null);
    const fitted = useRef(false);

    useEffect(() => {
        const m = L.map(el.current!, { zoomControl: true, preferCanvas: true }).setView(
            [-6.2, 106.83],
            12,
        );
        addBasemap(m);
        cellLayer.current = L.layerGroup().addTo(m);
        siteLayer.current = L.layerGroup().addTo(m);
        shockLayer.current = L.layerGroup().addTo(m);
        map.current = m;
        return () => {
            m.remove();
            map.current = null;
        };
    }, []);

    useEffect(() => {
        const m = map.current;
        const g = cellLayer.current;
        if (!m || !g) return;
        g.clearLayers();
        const renderer = L.canvas({ padding: 0.3 });
        const half = cellDeg / 2;
        const maxPts = Math.max(1, ...cells.map((c) => c.points));
        for (const c of cells) {
            L.rectangle(
                [
                    [c.lat - half, c.lng - half],
                    [c.lat + half, c.lng + half],
                ],
                {
                    renderer,
                    stroke: false,
                    fillColor: colorOf(c.avgSpeed),
                    // Sel yang sering dilalui lebih pekat.
                    fillOpacity: 0.35 + 0.5 * Math.min(1, c.points / maxPts),
                },
            )
                .bindTooltip(
                    `${fmtNum(c.avgSpeed, 1)} km/jam rata-rata · maks ${c.maxSpeed} · ${c.points} titik`,
                )
                .addTo(g);
        }
        if (!fitted.current && cells.length > 0) {
            fitted.current = true;
            m.fitBounds(L.latLngBounds(cells.map((c) => [c.lat, c.lng])), { padding: [24, 24] });
        }
    }, [cells, cellDeg]);

    useEffect(() => {
        const g = shockLayer.current;
        if (!g) return;
        g.clearLayers();
        for (const s of shocks) {
            const k = SHOCK[s.kind];
            L.circleMarker([s.lat, s.lng], {
                radius: 5,
                color: '#fff',
                weight: 1.5,
                fillColor: k.color,
                fillOpacity: 0.95,
            })
                .bindTooltip(
                    `${k.label}${s.g != null ? ` · ${fmtNum(s.g, 2)} G` : ''} · ${new Date(s.time).toLocaleString('id-ID')}`,
                )
                .addTo(g);
        }
    }, [shocks]);

    useEffect(() => {
        if (siteLayer.current) drawSites(siteLayer.current, sites);
    }, [sites]);

    return <div ref={el} className="h-full min-h-[420px] w-full rounded-xl border" />;
}
