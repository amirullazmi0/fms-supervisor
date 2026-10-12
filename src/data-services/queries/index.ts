import { QueriesDataService } from '../type';
import { authQueries, AuthQueryKeys } from './auth';
import { devicesQueries, DevicesQueryKeys } from './devices';
import { monitorQueries, MonitorQueryKeys } from './monitor';
import { sitesQueries, SitesQueryKeys } from './sites';
import { shiftsQueries, ShiftsQueryKeys } from './shifts';
import { reportsQueries, ReportsQueryKeys } from './reports';

export type AllQueryKeys =
    | AuthQueryKeys
    | DevicesQueryKeys
    | MonitorQueryKeys
    | SitesQueryKeys
    | ShiftsQueryKeys
    | ReportsQueryKeys;

export const allQueries: QueriesDataService<AllQueryKeys> = {
    ...authQueries,
    ...devicesQueries,
    ...monitorQueries,
    ...sitesQueries,
    ...shiftsQueries,
    ...reportsQueries,
};
