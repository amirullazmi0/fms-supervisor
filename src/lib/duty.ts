// Truk yang lagi bertugas: dari penugasan shift aktif di tiap rute (Route.onDuty).
import { useMemo } from 'react';
import { useData } from '@/provider/StreamProvider';

export interface Duty {
    shiftId: string;
    shiftName: string;
    driverId: string;
    driverName: string;
    routeId: string;
    routeName: string;
    // active = lagi shift; finishing = shift udah distop, nyelesaiin ritase terakhir ke unloading.
    phase: 'active' | 'finishing';
}

// Truk yang shift-nya udah beres (12 jam terakhir) dan sekarang nggak bertugas.
export interface DoneDuty extends Omit<Duty, 'phase'> {
    closedAt: number | null;
}

// imei -> tugasnya sekarang. Truk yang nggak ada di sini = nganggur.
export function useDuty(): Map<string, Duty> {
    const { routes } = useData();
    return useMemo(() => {
        const m = new Map<string, Duty>();
        for (const r of routes) {
            for (const d of r.onDuty) {
                const phase = d.phase === 'finishing' ? 'finishing' : 'active';
                if (phase === 'finishing' && m.get(d.imei)?.phase === 'active') continue; // a running shift wins
                m.set(d.imei, {
                    shiftId: d.shiftId,
                    shiftName: d.shiftName,
                    driverId: d.driverId,
                    driverName: d.driverName,
                    routeId: r.id,
                    routeName: r.name,
                    phase,
                });
            }
        }
        return m;
    }, [routes]);
}

// imei -> shift yang baru beres (truk "Selesai"), cuma buat truk yang lagi nggak bertugas.
export function useDone(): Map<string, DoneDuty> {
    const { routes } = useData();
    return useMemo(() => {
        const busy = new Set(routes.flatMap((r) => r.onDuty.map((d) => d.imei)));
        const m = new Map<string, DoneDuty>();
        for (const r of routes) {
            for (const d of r.recentDone ?? []) {
                if (busy.has(d.imei)) continue;
                const prev = m.get(d.imei);
                if (prev && (prev.closedAt ?? 0) >= (d.closedAt ?? 0)) continue; // keep the latest
                m.set(d.imei, {
                    shiftId: d.shiftId,
                    shiftName: d.shiftName,
                    driverId: d.driverId,
                    driverName: d.driverName,
                    routeId: r.id,
                    routeName: r.name,
                    closedAt: d.closedAt ?? null,
                });
            }
        }
        return m;
    }, [routes]);
}

// Label status kerja truk: Bertugas / Menyelesaikan ritase / Selesai / Nganggur.
export function workState(
    job: Duty | undefined,
    done: DoneDuty | undefined,
): { label: string; variant: 'success' | 'warning' | 'info' | 'muted' } {
    if (job?.phase === 'finishing') return { label: 'Menyelesaikan ritase', variant: 'warning' };
    if (job) return { label: 'Bertugas', variant: 'success' };
    if (done) return { label: 'Selesai', variant: 'info' };
    return { label: 'Nganggur', variant: 'muted' };
}
