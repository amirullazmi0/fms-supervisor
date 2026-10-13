import { QueriesDataService } from '@/data-services/type';

export type ShiftsQueryKeys =
    'drivers' | 'drivers-last' | 'shift-templates' | 'shifts' | 'shifts-by-id';

export const shiftsQueries: QueriesDataService<ShiftsQueryKeys> = {
    drivers: '/drivers',
    'drivers-last': '/drivers/last',
    'shift-templates': '/shift-templates',
    shifts: '/shifts',
    'shifts-by-id': '/shifts/:id',
};
