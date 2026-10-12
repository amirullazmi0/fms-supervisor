import { QueriesDataService } from '@/data-services/type';

export type MonitorQueryKeys = 'io-map' | 'events' | 'commands' | 'status' | 'logs' | 'place';

export const monitorQueries: QueriesDataService<MonitorQueryKeys> = {
    'io-map': '/io-map',
    events: '/events',
    commands: '/commands',
    status: '/status',
    logs: '/logs',
    place: '/place',
};
