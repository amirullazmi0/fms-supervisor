import { MutationDataService } from '@/data-services/type';

export type DevicesMutationKeys = 'devices-update' | 'devices-delete' | 'devices-command';

export const devicesMutations: MutationDataService<DevicesMutationKeys> = {
    'devices-update': { url: '/devices/:imei', method: 'PATCH', refetchQueries: ['devices'] },
    'devices-delete': { url: '/devices/:imei', method: 'DELETE', refetchQueries: ['devices'] },
    'devices-command': { url: '/devices/:imei/command', method: 'POST', refetchQueries: ['commands'] },
};
