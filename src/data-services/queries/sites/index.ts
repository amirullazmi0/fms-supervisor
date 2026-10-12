import { QueriesDataService } from '@/data-services/type';

export type SitesQueryKeys = 'sites' | 'routes' | 'routes-history' | 'road';

export const sitesQueries: QueriesDataService<SitesQueryKeys> = {
    sites: '/sites',
    routes: '/routes',
    'routes-history': '/routes/:id/history',
    road: '/road',
};
