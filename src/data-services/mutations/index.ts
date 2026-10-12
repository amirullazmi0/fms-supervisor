import { MutationDataService } from '../type';
import { authMutations, AuthMutationKeys } from './auth';
import { devicesMutations, DevicesMutationKeys } from './devices';
import { sitesMutations, SitesMutationKeys } from './sites';
import { shiftsMutations, ShiftsMutationKeys } from './shifts';

export type AllMutationKeys = AuthMutationKeys | DevicesMutationKeys | SitesMutationKeys | ShiftsMutationKeys;

export const allMutations: MutationDataService<AllMutationKeys> = {
    ...authMutations,
    ...devicesMutations,
    ...sitesMutations,
    ...shiftsMutations,
};
