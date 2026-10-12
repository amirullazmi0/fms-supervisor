import { MutationDataService } from '@/data-services/type';

export type AuthMutationKeys = 'login' | 'logout';

export const authMutations: MutationDataService<AuthMutationKeys> = {
    login: { url: '/auth/login', method: 'POST' },
    logout: { url: '/auth/logout', method: 'POST' },
};
