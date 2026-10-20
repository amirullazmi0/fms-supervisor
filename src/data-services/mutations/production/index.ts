import { MutationDataService } from '@/data-services/type';

export type ProductionMutationKeys =
    'sites-zones' | 'unit-status-set' | 'devices-mdt-pair' | 'mdt-tablets-revoke' | 'drivers-pin';

export const productionMutations: MutationDataService<ProductionMutationKeys> = {
    'sites-zones': { url: '/sites/:id/zones', method: 'PUT', refetchQueries: ['sites', 'routes'] },
    'unit-status-set': {
        url: '/unit-status',
        method: 'POST',
        refetchQueries: ['unit-status', 'unit-status-current'],
    },
    'devices-mdt-pair': {
        url: '/devices/:imei/mdt',
        method: 'POST',
        refetchQueries: ['devices-mdt'],
    },
    'mdt-tablets-revoke': {
        url: '/mdt-tablets/:id',
        method: 'DELETE',
        refetchQueries: ['devices-mdt'],
    },
    'drivers-pin': { url: '/drivers/:id/pin', method: 'PUT', refetchQueries: ['drivers'] },
};
