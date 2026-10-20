'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { addBasemap } from '@/lib/basemap';
import { ROUTE_COLOR, truckIcon } from '@/lib/markers';
import 'leaflet/dist/leaflet.css';
import { displayName } from '@/lib/format';
import type { Device, HistoryPoint } from '@/types/fleet';

const accent = () => ROUTE_COLOR;

interface Props {
    devices: Device[];
    selected: string | null;
    onSelect: (imei: string) => void;
    trail: HistoryPoint[];
    follow: boolean;
    className?: string;
}

// Peta Leaflet: marker per alat (warna = status, rotasi = arah), jejak alat yang dipilih.
export default function FleetMap({
    devices,
    selected,
    onSelect,
    trail,
    follow,
    className = 'h-full w-full',
}: Props) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const markers = useRef(new Map<string, L.Marker>());
    const line = useRef<L.Polyline | null>(null);
    const fitted = useRef(false);
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    useEffect(() => {
        const m = L.map(el.current!, { zoomControl: true }).setView([-6.2, 106.83], 12);
        addBasemap(m);
        line.current = L.polyline([], { color: accent(), weight: 3, opacity: 0.75 }).addTo(m);
        map.current = m;
        const ro = new ResizeObserver(() => m.invalidateSize());
        ro.observe(el.current!);
        const mk = markers.current;
        return () => {
            ro.disconnect();
            m.remove();
            mk.clear();
            fitted.current = false;
        };
    }, []);

    // Marker
    useEffect(() => {
        const m = map.current;
        if (!m) return;
        for (const d of devices) {
            if (!d.pos) continue;
            const ll: L.LatLngTuple = [d.pos.lat, d.pos.lng];
            let mk = markers.current.get(d.imei);
            if (mk) {
                mk.setLatLng(ll);
            } else {
                mk = L.marker(ll, { title: displayName(d) }).addTo(m);
                mk.on('click', () => onSelectRef.current(d.imei));
                markers.current.set(d.imei, mk);
            }
            mk.setIcon(truckIcon(d, displayName(d), d.imei === selected));
            mk.setZIndexOffset(d.imei === selected ? 1000 : 0);
        }
        if (!fitted.current) {
            const pts = devices
                .filter((d) => d.pos)
                .map((d) => [d.pos!.lat, d.pos!.lng] as L.LatLngTuple);
            if (pts.length === 1) m.setView(pts[0], 15);
            else if (pts.length > 1) m.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
            if (pts.length) fitted.current = true;
        }
    }, [devices, selected]);

    const sel = devices.find((x) => x.imei === selected);
    const lat = sel?.pos?.lat;
    const lng = sel?.pos?.lng;

    // Pindah ke alat yang baru dipilih
    const lastSelected = useRef<string | null>(null);
    useEffect(() => {
        if (selected === lastSelected.current || lat == null || lng == null) return;
        lastSelected.current = selected;
        map.current?.setView([lat, lng], Math.max(map.current.getZoom(), 14));
    }, [selected, lat, lng]);

    // Ikuti alat yang dipilih
    useEffect(() => {
        if (follow && lat != null && lng != null) map.current?.panTo([lat, lng], { animate: true });
    }, [follow, lat, lng]);

    // Jejak
    useEffect(() => {
        line.current?.setLatLngs(
            trail.filter((p) => p.v).map((p) => [p.lat, p.lng] as L.LatLngTuple),
        );
        line.current?.setStyle({ color: accent() });
    }, [trail]);

    return <div ref={el} className={className} aria-label="Peta posisi unit" />;
}
