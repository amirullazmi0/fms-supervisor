// Helper format tampilan.
import type { Device, IoDef, IoValue } from '@/types/fleet';

export type Status = 'moving' | 'idle' | 'parked' | 'offline';
export type IoTable = Record<string, IoDef>;

export const STATUS_LABEL: Record<Status, string> = {
    moving: 'Jalan',
    idle: 'Idle',
    parked: 'Parkir',
    offline: 'Offline',
};

// Tracker Teltonika rutin nutup koneksi kalau lagi nggak ada data, terus buka lagi pas mau kirim.
// Jadi "offline" bukan berarti koneksinya ketutup, tapi alat udah lama nggak ngirim apa-apa.
export const STALE_MS = 90 * 60e3;

// Kapan terakhir ada kabar dari alat (koneksi atau record), tetap kebaca setelah server restart.
export const lastHeard = (d: Device): number => Math.max(d.lastSeen ?? 0, d.last?.time ?? 0);

export function statusOf(d: Device): Status {
    if (!d.online && Date.now() - lastHeard(d) > STALE_MS) return 'offline';
    if (d.online && (d.last?.speed ?? 0) > 3) return 'moving';
    return d.io[239] ? 'idle' : 'parked';
}

export const displayName = (d: Pick<Device, 'name' | 'imei'>): string =>
    d.name || `FMC150 …${d.imei.slice(-5)}`;

export const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
export const fmtHm = (ms: number) =>
    new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (ms: number) =>
    new Date(ms).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
export const fmtNum = (n: number, dec = 0) =>
    Number(n).toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export function stamp(ms: number): string {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function ago(ms: number | null | undefined): string {
    if (!ms) return '—';
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return `${s} dtk lalu`;
    if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
    return `${Math.floor(s / 86400)} hari lalu`;
}

function decimalsFor(scale?: number): number {
    if (!scale || scale >= 1) return 0;
    return Math.min(3, Math.round(-Math.log10(scale)));
}

export function fmtIo(io: IoTable, id: string | number, raw: IoValue | undefined): string {
    const def = io[id];
    if (raw == null) return '—';
    if (!def) return String(raw);
    if (def.kind === 'bool') return raw ? 'ON' : 'OFF';
    if (def.enum && def.enum[Number(raw)] != null) return def.enum[Number(raw)];
    if (def.enum || def.kind === 'id') return String(raw);
    if (typeof raw !== 'number') return String(raw);
    const v = def.scale ? raw * def.scale : raw;
    return `${fmtNum(v, decimalsFor(def.scale))}${def.unit ? ` ${def.unit}` : ''}`;
}

// Nilai IO sebagai angka (IO bisa berupa string hex buat parameter NX).
export const num = (v: IoValue | undefined): number | null => (typeof v === 'number' ? v : null);

// "1 j 12 mnt", "45 mnt", "30 dtk"
export function fmtDuration(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s} dtk`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} mnt`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h} j ${m % 60} mnt` : `${h} j`;
}

export const fmtKm = (meters: number): string => fmtNum(meters / 1000, meters < 10000 ? 1 : 0);

// Label truk: plat nomor kalau ada, kalau nggak nama alat.
export const truckLabel = (d: Pick<Device, 'name' | 'imei' | 'plate'>): string =>
    d.plate || displayName(d);

// Tanggal lokal YYYY-MM-DD (buat input type=date dan tanggal kerja shift).
const pad2 = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date | number = new Date()): string => {
    const x = typeof d === 'number' ? new Date(d) : d;
    return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};
// Jam lokal HH:MM dari milidetik, dan sebaliknya (tanggal + HH:MM -> ms).
export const hmOf = (ms: number): string => {
    const x = new Date(ms);
    return `${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
};
export const atTime = (date: string, hm: string): number => new Date(`${date}T${hm}:00`).getTime();
export const fmtDate = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
export const addDays = (key: string, n: number): string => {
    const d = new Date(`${key}T00:00:00`);
    d.setDate(d.getDate() + n);
    return dateKey(d);
};
