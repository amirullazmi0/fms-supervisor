// Papan unit dispatcher: tiap unit yang bertugas sekarang + operator, rute, aktivitas GPS, status
// MDT, dan "kolom" papan (working / antre / standby / breakdown / tanpa data). Semua dari data yang
// sudah ada (useData + unit-status-current), tanpa endpoint baru.
import { useMemo } from 'react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { activityOf } from '@/lib/activity';
import type { Activity } from '@/lib/activity';
import { truckLabel } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import { useData } from '@/provider/StreamProvider';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { UnitStatusLog } from '@/types/fleet';

export type BoardColumn = 'working' | 'queue' | 'standby' | 'breakdown' | 'nodata';

export const BOARD_COLUMNS: { id: BoardColumn; label: string; tone: string }[] = [
    { id: 'working', label: 'Working', tone: 'bg-success-soft text-success' },
    { id: 'queue', label: 'Antre', tone: 'bg-warning-soft text-warning' },
    { id: 'standby', label: 'Standby', tone: 'bg-info-soft text-info' },
    { id: 'breakdown', label: 'Breakdown', tone: 'bg-danger-soft text-destructive' },
    { id: 'nodata', label: 'Tanpa data', tone: 'bg-muted text-muted-foreground' },
];

export interface BoardUnit {
    imei: string;
    unit: string;
    driverId: string;
    driverName: string;
    shiftId: string;
    shiftName: string;
    routeId: string;
    routeName: string;
    activity: Activity;
    mdt: UnitStatusLog | null;
    column: BoardColumn;
    since: number | null; // mulai status MDT (bila ada)
}

// Kolom papan: status MDT menang (operator yang paling tahu: sholat, BD, …), lalu GPS.
function columnOf(a: Activity, mdt: UnitStatusLog | null): BoardColumn {
    if (mdt?.status === 'breakdown') return 'breakdown';
    if (mdt?.delayCode === 'Q_LOAD' || mdt?.delayCode === 'Q_DUMP' || a.kind === 'queue')
        return 'queue';
    if (mdt?.status === 'standby') return 'standby';
    if (a.kind === 'nodata' || a.stale) return 'nodata';
    return 'working';
}

export function useUnitStatuses() {
    const can = useCan();
    return useQueryApiRequest<GlobalApiResponse<UnitStatusLog[]>>({
        key: 'unit-status-current',
        config: { errorNotification: false },
        options: { enabled: can(P.deviceRead) || can(P.reportRead), refetchInterval: 60000 },
    });
}

export function useUnitBoard(): BoardUnit[] {
    const { routes, sites, devices } = useData();
    const statuses = useUnitStatuses();
    return useMemo(() => {
        const status = new Map((statuses.data?.data ?? []).map((l) => [l.imei, l]));
        const siteById = new Map(sites.map((s) => [s.id, s]));
        const out: BoardUnit[] = [];
        for (const r of routes) {
            for (const d of r.onDuty) {
                if (d.phase && d.phase !== 'active') continue;
                const dev = devices[d.imei];
                const activity = activityOf(
                    dev,
                    siteById.get(r.loadingId),
                    siteById.get(r.unloadingId),
                );
                const mdt = status.get(d.imei) ?? null;
                out.push({
                    imei: d.imei,
                    unit: dev ? truckLabel(dev) : d.imei,
                    driverId: d.driverId,
                    driverName: d.driverName,
                    shiftId: d.shiftId,
                    shiftName: d.shiftName,
                    routeId: r.id,
                    routeName: r.name,
                    activity,
                    mdt,
                    column: columnOf(activity, mdt),
                    since: mdt?.startAt ?? null,
                });
            }
        }
        return out.sort((a, b) => a.unit.localeCompare(b.unit));
    }, [routes, sites, devices, statuses.data]);
}
