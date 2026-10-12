import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;

    setUser: (user: User) => void;
    clearAuth: () => void;

    // Helper: does the logged-in user hold this permission?
    can: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,

            setUser: (user) => set({ user, isAuthenticated: true }),
            clearAuth: () => set({ user: null, isAuthenticated: false }),

            can: (permission) => Boolean(get().user?.permissions?.includes(permission)),
        }),
        {
            name: 'fms-supervisor-auth-storage', // localStorage key
            // Only the user is persisted; tokens live in cookies.
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        },
    ),
);
