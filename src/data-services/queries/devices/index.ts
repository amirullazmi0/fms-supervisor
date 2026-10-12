import { QueriesDataService } from '@/data-services/type';

export type DevicesQueryKeys = 'devices' | 'devices-by-imei' | 'devices-day' | 'devices-ritase' | 'devices-records' | 'devices-raw';

export const devicesQueries: QueriesDataService<DevicesQueryKeys> = {
    devices: '/devices',
    'devices-by-imei': '/devices/:imei',
    'devices-day': '/devices/:imei/day',
    'devices-ritase': '/devices/:imei/ritase',
    'devices-records': '/devices/:imei/records',
    'devices-raw': '/devices/:imei/raw',
};
