// Lagi ngapain unit sekarang & di mana, dari posisi GPS terakhir terhadap front loading / dumping
// rutenya (plus zona antre / spot kalau ada) dan arah hadap unit.
import { distanceM } from '@/lib/geo';
import type { Device, Site, SiteZone } from '@/types/fleet';

export type ActivityKind =
    | 'loading'
    | 'dumping'
    | 'queue'
    | 'site'
    | 'hauling'
    | 'return'
    | 'stopped'
    | 'parked'
    | 'stale'
    | 'nodata';

export interface Activity {
    kind: ActivityKind;
    label: string; // "Antre di Pit A", "Hauling → Jetty 2"
    detail: string | null; // "2,4 km lagi · 35 km/jam"
    stale: boolean; // data GPS lama (blank spot): yang ditampilkan = posisi terakhir
}

export const ACTIVITY_TONE: Record<ActivityKind, string> = {
    loading: 'bg-success-soft text-success',
    dumping: 'bg-success-soft text-success',
    hauling: 'bg-info-soft text-info',
    return: 'bg-info-soft text-info',
    queue: 'bg-warning-soft text-warning',
    site: 'bg-muted text-foreground',
    stopped: 'bg-warning-soft text-warning',
    parked: 'bg-muted text-muted-foreground',
    stale: 'bg-muted text-muted-foreground',
    nodata: 'bg-muted text-muted-foreground',
};

const STILL_KMH = 3;
const APPROACH_M = 300; // antre biasanya nggak jauh dari radius titik
const STALE_MS = 10 * 60e3;

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const r = Math.PI / 180;
    const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
    const x =
        Math.cos(a.lat * r) * Math.sin(b.lat * r) -
        Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
    return (Math.atan2(y, x) / r + 360) % 360;
}

const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const km = (m: number) =>
    m < 1000
        ? `${Math.round(m)} m`
        : `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
const inZone = (
    p: { lat: number; lng: number },
    zones: SiteZone[] | undefined,
    kind: SiteZone['kind'],
) => (zones ?? []).some((z) => z.kind === kind && distanceM(p, z) <= z.radius);

// Di dalam / dekat satu titik: loading / dumping (zona spot), antre (zona antre atau diam dekat titik), atau manuver.
function atSite(
    p: { lat: number; lng: number },
    speed: number,
    s: Site,
    work: 'loading' | 'dumping',
): Activity | null {
    const d = distanceM(p, s);
    const hasQueue = (s.zones ?? []).some((z) => z.kind === 'queue');
    const hasSpot = (s.zones ?? []).some((z) => z.kind === 'spot');
    if (inZone(p, s.zones, 'spot'))
        return {
            kind: work,
            label: `${work === 'loading' ? 'Loading' : 'Dumping'} di ${s.name}`,
            detail: null,
            stale: false,
        };
    if (inZone(p, s.zones, 'queue'))
        return { kind: 'queue', label: `Antre di ${s.name}`, detail: null, stale: false };
    if (d <= s.radius) {
        if (hasSpot)
            return { kind: 'site', label: `Manuver di ${s.name}`, detail: null, stale: false };
        return speed < STILL_KMH
            ? {
                  kind: work,
                  label: `${work === 'loading' ? 'Loading' : 'Dumping'} / antre di ${s.name}`,
                  detail: null,
                  stale: false,
              }
            : { kind: 'site', label: `Manuver di ${s.name}`, detail: null, stale: false };
    }
    if (!hasQueue && speed < STILL_KMH && d <= s.radius + APPROACH_M)
        return {
            kind: 'queue',
            label: `Antre di ${s.name}`,
            detail: `${km(d)} dari titik`,
            stale: false,
        };
    return null;
}

export function activityOf(
    d: Device | undefined,
    from: Site | undefined,
    to: Site | undefined,
    now = Date.now(),
): Activity {
    if (!d?.pos) return { kind: 'nodata', label: 'Belum ada data GPS', detail: null, stale: false };
    const p = d.pos;
    const speed = d.last?.time === p.time ? d.last.speed : 0;
    const stale = now - p.time > STALE_MS;
    const mark = (a: Activity): Activity =>
        stale
            ? {
                  ...a,
                  stale: true,
                  detail: [a.detail, 'posisi terakhir'].filter(Boolean).join(' · '),
              }
            : a;

    if (!from || !to) {
        return mark(
            speed >= STILL_KMH
                ? { kind: 'hauling', label: 'Jalan (tanpa rute)', detail: `${speed} km/jam`, stale }
                : { kind: 'parked', label: 'Diam (tanpa rute)', detail: null, stale },
        );
    }
    const site = atSite(p, speed, from, 'loading') ?? atSite(p, speed, to, 'dumping');
    if (site) return mark(site);

    const toU = distanceM(p, to);
    const toL = distanceM(p, from);
    if (speed < STILL_KMH) {
        const near = toU < toL ? to : from;
        return mark({
            kind: 'stopped',
            label: 'Berhenti di jalan',
            detail: `${km(Math.min(toU, toL))} dari ${near.name}`,
            stale,
        });
    }
    // Arah hadap lebih dekat ke arah dumping = bermuatan (hauling), sebaliknya kosongan (return).
    const goingToU = angleDiff(p.angle, bearing(p, to)) <= angleDiff(p.angle, bearing(p, from));
    return mark(
        goingToU
            ? {
                  kind: 'hauling',
                  label: `Hauling → ${to.name}`,
                  detail: `${km(toU)} lagi · ${speed} km/jam`,
                  stale,
              }
            : {
                  kind: 'return',
                  label: `Return → ${from.name}`,
                  detail: `${km(toL)} lagi · ${speed} km/jam`,
                  stale,
              },
    );
}
