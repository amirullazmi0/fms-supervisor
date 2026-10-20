// GET /reports/visits & /reports/visits/list: time at loading / unloading sites.
export interface DwellStats {
    visits: number;
    avgDwellMs: number;
    minDwellMs: number;
    maxDwellMs: number;
    totalMs: number;
    inside: number;
}

export interface VisitReport {
    from: number;
    to: number;
    loading: DwellStats;
    unloading: DwellStats;
}

export interface SiteVisitRecord {
    id: string;
    imei: string;
    truck: string;
    driverName: string | null;
    shiftName: string | null;
    routeName: string | null;
    siteName: string;
    role: 'loading' | 'unloading';
    status: 'inside' | 'done' | 'finished'; // finished = shift ditutup saat unit masih di titik
    arriveAt: number;
    departAt: number | null;
    dwellMs: number;
}
