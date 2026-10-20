// Istilah tambang yang dipakai di layar (FMS-NOTES-PELATIHAN.md bagian 7). Path & API tetap.
import type { DelayCategory, HourStatus, UnitStatus, UnitType, ZoneKind } from '@/types/fleet';

export const UNIT_TYPE: Record<UnitType, string> = {
    DT: 'Dump Truck (DT)',
    EX: 'Excavator (EX)',
    LV: 'Light Vehicle (LV)',
    SUPPORT: 'Alat support (grader, dozer, water/fuel truck)',
};

export const UNIT_STATUS: Record<UnitStatus, string> = {
    working: 'Working',
    standby: 'Standby',
    breakdown: 'Breakdown (BD)',
};

export const DELAY_CATEGORY: Record<DelayCategory, string> = {
    working: 'Operasi',
    standby_planned: 'Standby terencana',
    standby_unplanned: 'Standby tidak terencana',
    breakdown: 'Breakdown',
};

// Warna per kategori: hijau / biru / kuning / merah (sama dengan tombol di MDT).
export const DELAY_TONE: Record<DelayCategory, string> = {
    working: 'bg-success-soft text-success',
    standby_planned: 'bg-info-soft text-info',
    standby_unplanned: 'bg-warning-soft text-warning',
    breakdown: 'bg-danger-soft text-destructive',
};

export const ZONE_KIND: Record<ZoneKind, { label: string; hint: string; color: string }> = {
    queue: {
        label: 'Zona antre',
        hint: 'Jalur tunggu sebelum spot. Waktu di sini = antre (queuing).',
        color: '#c27803',
    },
    spot: {
        label: 'Zona spot',
        hint: 'Posisi muat / dumping. Waktu di sini = spotting + loading / dumping.',
        color: '#2f6fe4',
    },
};

export const HOUR_STATUS: Record<HourStatus, { label: string; hint: string; tone: string }> = {
    berjalan: {
        label: 'Berjalan',
        hint: 'Jam ini belum lewat',
        tone: 'bg-muted text-muted-foreground',
    },
    sementara: {
        label: 'Sementara',
        hint: 'Ada unit yang datanya belum masuk sampai akhir jam (blank spot). Angka bisa naik.',
        tone: 'bg-warning-soft text-warning',
    },
    final: {
        label: 'Final',
        hint: 'Semua unit sudah kirim data melewati jam ini',
        tone: 'bg-success-soft text-success',
    },
};

export const SOURCE: Record<string, string> = {
    mdt: 'MDT operator',
    supervisor: 'Supervisor',
    auto: 'Otomatis',
    dmr: 'Radio DMR',
};

// Tahap cycle time (notes 2.4).
export const STAGE = {
    queueLoad: 'Antre di front',
    spotLoad: 'Spotting + loading',
    workLoad: 'Manuver di front',
    hauling: 'Hauling (bermuatan)',
    queueDump: 'Antre di dumping',
    spotDump: 'Spotting + dumping',
    workDump: 'Manuver di dumping',
    returning: 'Return (kosongan)',
};
