import { MutationDataService } from '@/data-services/type';

export type SitesMutationKeys =
    | 'sites-create'
    | 'sites-update'
    | 'sites-delete'
    | 'routes-create'
    | 'routes-update'
    | 'routes-delete';

export const sitesMutations: MutationDataService<SitesMutationKeys> = {
    'sites-create': { url: '/sites', method: 'POST', refetchQueries: ['sites'] },
    'sites-update': { url: '/sites/:id', method: 'PUT', refetchQueries: ['sites', 'routes'] },
    'sites-delete': { url: '/sites/:id', method: 'DELETE', refetchQueries: ['sites'] },
    'routes-create': { url: '/routes', method: 'POST', refetchQueries: ['routes'] },
    'routes-update': { url: '/routes/:id', method: 'PUT', refetchQueries: ['routes', 'routes-history'] },
    'routes-delete': { url: '/routes/:id', method: 'DELETE', refetchQueries: ['routes'] },
};
