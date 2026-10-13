import { useAuthStore } from '@/stores/auth.store';
import type { User } from '@/types/auth';

// Tokens are httpOnly cookies set by the BFF; the page only keeps the user in the store.
export const syncUserToStore = (user: User) => {
    useAuthStore.getState().setUser(user);
};

export const clearAuthFromStore = () => {
    useAuthStore.getState().clearAuth();
};
