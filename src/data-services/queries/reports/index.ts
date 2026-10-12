import { QueriesDataService } from '@/data-services/type';

export type ReportsQueryKeys = 'reports' | 'reports-trips' | 'reports-visits' | 'reports-visits-list';

export const reportsQueries: QueriesDataService<ReportsQueryKeys> = {
    reports: '/reports',
    'reports-trips': '/reports/trips',
    'reports-visits': '/reports/visits',
    'reports-visits-list': '/reports/visits/list',
};
