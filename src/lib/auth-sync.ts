import Cookies from 'js-cookie';
import { useAuthStore } from '@/stores/auth.store';
import type { User } from '@/types/auth';

const REFRESH_TOKEN_DAYS = 7;

const baseCookieOptions = {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
};

export const setAuthCookies = (accessToken: string, refreshToken?: string, expiresInSeconds?: number) => {
    Cookies.set('accessToken', accessToken, {
        ...baseCookieOptions,
        expires: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : REFRESH_TOKEN_DAYS,
    });
    if (refreshToken) {
        Cookies.set('refreshToken', refreshToken, { ...baseCookieOptions, expires: REFRESH_TOKEN_DAYS });
    }
};

/**
 * The role name drives route gating in proxy.ts, so it has to outlive the access token
 * and stay for as long as the session can be refreshed.
 */
export const setUserRoleCookie = (role: string) => {
    Cookies.set('userRole', role, { ...baseCookieOptions, expires: REFRESH_TOKEN_DAYS });
};

export const clearAuthCookies = () => {
    Cookies.remove('accessToken', { path: '/' });
    Cookies.remove('refreshToken', { path: '/' });
    Cookies.remove('userRole', { path: '/' });
};

export const syncUserToStore = (user: User) => {
    useAuthStore.getState().setUser(user);
};

export const clearAuthFromStore = () => {
    useAuthStore.getState().clearAuth();
};
