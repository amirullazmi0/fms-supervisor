import { QueriesDataService } from '@/data-services/type';

// Produksi per jam, target, kesegaran data, status unit (MDT / supervisor), tablet MDT.
export type ProductionQueryKeys =
    | 'reports-hourly'
    | 'reports-freshness'
    | 'reports-stages'
    | 'reports-availability'
    | 'dispatch-fleets'
    | 'reports-heatmap'
    | 'reports-overspeed'
    | 'reports-breakdowns'
    | 'reports-operators'
    | 'features'
    | 'speed-zones'
    | 'production-targets'
    | 'delay-codes'
    | 'unit-status'
    | 'unit-status-current'
    | 'devices-mdt';

export const productionQueries: QueriesDataService<ProductionQueryKeys> = {
    'reports-hourly': '/reports/hourly',
    'reports-freshness': '/reports/freshness',
    'reports-stages': '/reports/stages',
    'reports-availability': '/reports/availability',
    'dispatch-fleets': '/dispatch/fleets',
    'reports-heatmap': '/reports/heatmap',
    'reports-overspeed': '/reports/overspeed',
    'reports-breakdowns': '/reports/breakdowns',
    'reports-operators': '/reports/operators',
    features: '/features',
    'speed-zones': '/speed-zones',
    'production-targets': '/production-targets',
    'delay-codes': '/delay-codes',
    'unit-status': '/unit-status',
    'unit-status-current': '/unit-status/current',
    'devices-mdt': '/devices/:imei/mdt',
};
