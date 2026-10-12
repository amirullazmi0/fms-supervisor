import { MutationDataService } from '@/data-services/type';
import { AllQueryKeys } from '@/data-services/queries';

export type ShiftsMutationKeys =
    | 'drivers-create'
    | 'drivers-update'
    | 'drivers-delete'
    | 'shifts-create'
    | 'shifts-update'
    | 'shifts-delete'
    | 'shifts-start'
    | 'shifts-close'
    | 'shifts-reopen'
    | 'shifts-assign'
    | 'shifts-copy-previous'
    | 'assignments-update'
    | 'assignments-delete';

// Anything touching a shift can change who is on duty (routes/sites carry onDuty).
const SHIFT_VIEWS: AllQueryKeys[] = ['shifts', 'shifts-by-id', 'routes', 'sites', 'drivers-last'];

export const shiftsMutations: MutationDataService<ShiftsMutationKeys> = {
    'drivers-create': { url: '/drivers', method: 'POST', refetchQueries: ['drivers'] },
    'drivers-update': { url: '/drivers/:id', method: 'PUT', refetchQueries: ['drivers', 'routes'] },
    'drivers-delete': { url: '/drivers/:id', method: 'DELETE', refetchQueries: ['drivers'] },
    'shifts-create': { url: '/shifts', method: 'POST', refetchQueries: SHIFT_VIEWS },
    'shifts-update': { url: '/shifts/:id', method: 'PATCH', refetchQueries: SHIFT_VIEWS },
    'shifts-delete': { url: '/shifts/:id', method: 'DELETE', refetchQueries: SHIFT_VIEWS },
    'shifts-start': { url: '/shifts/:id/start', method: 'POST', refetchQueries: SHIFT_VIEWS },
    'shifts-close': { url: '/shifts/:id/close', method: 'POST', refetchQueries: SHIFT_VIEWS },
    'shifts-reopen': { url: '/shifts/:id/reopen', method: 'POST', refetchQueries: SHIFT_VIEWS },
    'shifts-assign': { url: '/shifts/:id/assignments', method: 'POST', refetchQueries: SHIFT_VIEWS },
    'shifts-copy-previous': { url: '/shifts/:id/copy-previous', method: 'POST', refetchQueries: SHIFT_VIEWS },
    'assignments-update': { url: '/assignments/:id', method: 'PUT', refetchQueries: SHIFT_VIEWS },
    'assignments-delete': { url: '/assignments/:id', method: 'DELETE', refetchQueries: [...SHIFT_VIEWS, 'reports'] },
};
