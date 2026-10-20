import { QueriesDataService } from '../type';
import { authQueries, AuthQueryKeys } from './auth';
import { devicesQueries, DevicesQueryKeys } from './devices';
import { monitorQueries, MonitorQueryKeys } from './monitor';
import { sitesQueries, SitesQueryKeys } from './sites';
import { shiftsQueries, ShiftsQueryKeys } from './shifts';
import { reportsQueries, ReportsQueryKeys } from './reports';
import { productionQueries, ProductionQueryKeys } from './production';

export type AllQueryKeys =
    | AuthQueryKeys
    | DevicesQueryKeys
    | MonitorQueryKeys
    | SitesQueryKeys
    | ShiftsQueryKeys
    | ReportsQueryKeys
    | ProductionQueryKeys;

export const allQueries: QueriesDataService<AllQueryKeys> = {
    ...authQueries,
    ...devicesQueries,
    ...monitorQueries,
    ...sitesQueries,
    ...shiftsQueries,
    ...reportsQueries,
    ...productionQueries,
};
