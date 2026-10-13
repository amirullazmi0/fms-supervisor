import axios from 'axios';
import { clearAuthFromStore } from './auth-sync';

// All calls go to this app's BFF (/api); it adds the token and renews the session itself.
export const axiosInstance = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

const PUBLIC_PATHS = ['/auth/sign-in'];

// The BFF already tried to renew the session: a 401 here means signing in again.
export const redirectToLogin = () => {
    clearAuthFromStore();
    if (globalThis.window !== undefined && !PUBLIC_PATHS.includes(globalThis.window.location.pathname)) {
        globalThis.window.location.href = '/auth/sign-in';
    }
};

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !String(error.config?.url ?? '').includes('/auth/login')) redirectToLogin();
        throw error;
    },
);
