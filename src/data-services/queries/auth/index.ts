import { QueriesDataService } from '@/data-services/type';

export type AuthQueryKeys = 'profile';

export const authQueries: QueriesDataService<AuthQueryKeys> = {
    profile: '/users/profile',
};
