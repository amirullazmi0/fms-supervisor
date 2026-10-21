'use client';
// Peta heat map jalan (P3-2): gradasi halus biru → hijau → kuning → merah di atas peta (teknik
// simpleheat di canvas, tanpa dependensi tambahan). Mode "slow": merah = unit lambat & sering lewat
// (titik panas / bottleneck). Mode "traffic": merah = jalan paling padat. Plus titik guncangan
// akselerometer dan pit / stockpile / jetty.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBasemap } from '@/lib/basemap';
import { drawSites } from '@/lib/siteLayer';
import { fmtNum } from '@/lib/format';
import type { HeatCell, ShockPoint, Site } from '@/types/fleet';

export type HeatMode = 'slow' | 'traffic';

// Gradasi warna (posisi 0..1 → warna), sama untuk legenda.
export const HEAT_GRADIENT: [number, string][] = [
    [0.15, '#2563eb'],
    [0.4, '#22c55e'],
    [0.6, '#facc15'],
    [0.8, '#f97316'],
    [1, '#dc2626'],
];

export const SHOCK: Record<ShockPoint['kind'], { label: string; color: string }> = {
    brake: { label: 'Rem mendadak', color: '#b91c1c' },
    accel: { label: 'Akselerasi keras', color: '#ea580c' },
    corner: { label: 'Belok tajam', color: '#7c3aed' },
    crash: { label: 'Benturan / tabrakan', color: '#111827' },
};

// Bobot tiap sel 0..1. slow: makin lambat (< 40 km/jam) & makin sering dilalui makin panas.
function weights(cells: HeatCell[], mode: HeatMode): number[] {
    const maxPts = Math.max(1, ...cells.map((c) => c.points));
    const raw = cells.map((c) => {
        const traffic = Math.sqrt(c.points / maxPts);
        if (mode === 'traffic') return traffic;
        // Relatif terhadap kecepatan tertinggi di data: jalan paling lambat periode ini = merah.
        const slow = 1 - c.avgSpeed / Math.max(40, ...cells.map((x) => x.avgSpeed));
        return Math.max(0, slow) * (0.4 + 0.6 * traffic);
    });
    // Normalisasi: sel terpanas = 1, agar gradasi selalu terbaca.
    const top = Math.max(1e-6, ...raw);
    return raw.map((w) => w / top);
}

// Palet 256 warna dari HEAT_GRADIENT (RGBA berurutan).
function palette(): Uint8ClampedArray {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    for (const [at, color] of HEAT_GRADIENT) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, 256);
    return ctx.getImageData(0, 0, 1, 256).data;
}

// Layer canvas heat map: digambar ulang setiap peta digeser / di-zoom.
class HeatLayer extends L.Layer {
    private canvas?: HTMLCanvasElement;
    private pts: { ll: L.LatLng; w: number }[] = [];
    private pal?: Uint8ClampedArray;

    setData(pts: { ll: L.LatLng; w: number }[]) {
        this.pts = pts;
        this.redraw();
    }

    onAdd(map: L.Map) {
        this.canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide') as HTMLCanvasElement;
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.opacity = '0.8';
        map.getPanes().overlayPane.appendChild(this.canvas);
        map.on('moveend zoomend resize', this.redraw, this);
        this.redraw();
        return this;
    }

    onRemove(map: L.Map) {
        this.canvas?.remove();
        map.off('moveend zoomend resize', this.redraw, this);
        return this;
    }

    redraw() {
        const map = this._map;
        const cv = this.canvas;
        if (!map || !cv) return;
        const size = map.getSize();
        cv.width = size.x;
        cv.height = size.y;
        L.DomUtil.setPosition(cv, map.containerPointToLayerPoint([0, 0]));
        const ctx = cv.getContext('2d')!;
        ctx.clearRect(0, 0, size.x, size.y);
        if (this.pts.length === 0) return;

        // Radius ±45 m di tanah, dibatasi 14–60 px agar tetap terbaca di semua zoom.
        const c = map.getCenter();
        const mPerPx =
            (40075016.686 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, map.getZoom() + 8);
        const r = Math.max(18, Math.min(70, 60 / mPerPx));

        // 1) Bayangan hitam berlapis: alpha = bobot.
        const stamp = document.createElement('canvas');
        stamp.width = stamp.height = r * 2;
        const sctx = stamp.getContext('2d')!;
        const grad = sctx.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, r * 2, r * 2);
        // Gabungkan sel yang jatuh di grid piksel yang sama (nilai terbesar), supaya zoom jauh
        // tidak membuat semuanya merah karena puluhan sel bertumpuk.
        const bounds = map.getBounds().pad(0.2);
        const step = r / 2;
        const grid = new Map<string, { x: number; y: number; w: number }>();
        for (const p of this.pts) {
            if (p.w <= 0 || !bounds.contains(p.ll)) continue;
            const pt = map.latLngToContainerPoint(p.ll);
            const key = `${Math.round(pt.x / step)}|${Math.round(pt.y / step)}`;
            const cur = grid.get(key);
            if (!cur || p.w > cur.w) grid.set(key, { x: pt.x, y: pt.y, w: p.w });
        }
        for (const g of grid.values()) {
            ctx.globalAlpha = Math.min(1, Math.max(0.06, g.w * 0.45));
            ctx.drawImage(stamp, g.x - r, g.y - r);
        }
        ctx.globalAlpha = 1;

        // 2) Warnai: alpha bayangan → warna palet.
        this.pal ??= palette();
        const img = ctx.getImageData(0, 0, size.x, size.y);
        const d = img.data;
        for (let i = 3; i < d.length; i += 4) {
            const a = d[i];
            if (!a) continue;
            const j = a * 4;
            d[i - 3] = this.pal[j];
            d[i - 2] = this.pal[j + 1];
            d[i - 1] = this.pal[j + 2];
            d[i] = Math.min(255, a * 1.6);
        }
        ctx.putImageData(img, 0, 0);
    }
}

export default function HeatMap({
    cells,
    shocks,
    sites,
    mode,
}: {
    cells: HeatCell[];
    shocks: ShockPoint[];
    sites: Site[];
    mode: HeatMode;
}) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const heat = useRef<HeatLayer | null>(null);
    const hoverLayer = useRef<L.LayerGroup | null>(null);
    const shockLayer = useRef<L.LayerGroup | null>(null);
    const siteLayer = useRef<L.LayerGroup | null>(null);
    const fitted = useRef(false);

    useEffect(() => {
        const m = L.map(el.current!, { zoomControl: true, preferCanvas: true }).setView(
            [-6.2, 106.83],
            12,
        );
        addBasemap(m);
        heat.current = new HeatLayer().addTo(m);
        hoverLayer.current = L.layerGroup().addTo(m);
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
        if (!m || !heat.current || !hoverLayer.current) return;
        const w = weights(cells, mode);
        heat.current.setData(cells.map((c, i) => ({ ll: L.latLng(c.lat, c.lng), w: w[i] })));

        // Titik tak terlihat untuk tooltip angka saat kursor di atas jalan.
        const g = hoverLayer.current;
        g.clearLayers();
        const renderer = L.canvas({ padding: 0.3 });
        for (const c of cells) {
            L.circleMarker([c.lat, c.lng], { renderer, radius: 6, stroke: false, fillOpacity: 0 })
                .bindTooltip(
                    `${fmtNum(c.avgSpeed, 1)} km/jam rata-rata · maks ${c.maxSpeed} · ${c.points} titik GPS`,
                )
                .addTo(g);
        }
        if (!fitted.current && cells.length > 0) {
            fitted.current = true;
            m.fitBounds(L.latLngBounds(cells.map((c) => [c.lat, c.lng])), { padding: [24, 24] });
        }
    }, [cells, mode]);

    useEffect(() => {
        const g = shockLayer.current;
        if (!g) return;
        g.clearLayers();
        for (const s of shocks) {
            const k = SHOCK[s.kind];
            L.circleMarker([s.lat, s.lng], {
                radius: 4,
                color: '#fff',
                weight: 1,
                fillColor: k.color,
                fillOpacity: 0.9,
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

    return <div ref={el} className="h-full min-h-[460px] w-full rounded-xl border" />;
}
