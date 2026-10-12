import axios, { AxiosRequestConfig } from 'axios';
import cookies from 'js-cookie';
import { setAuthCookies, clearAuthCookies, clearAuthFromStore } from './auth-sync';
import { AuthResponse } from '@/types/auth';
import { GlobalApiResponse } from '@/types/api/responses';

export const getAuthToken = () => cookies.get('accessToken') || '';

export const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use(
    (config) => {
        const token = getAuthToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => {
        throw error;
    },
);

// While one refresh is running, other 401s wait in this queue and replay with the new token.
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
    failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
    failedQueue = [];
};

const PUBLIC_PATHS = ['/auth/sign-in'];
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];
const shouldSkipRefresh = (url?: string) => AUTH_ENDPOINTS.some((path) => url?.includes(path));

const redirectToLogin = () => {
    clearAuthFromStore();
    clearAuthCookies();
    if (globalThis.window !== undefined && !PUBLIC_PATHS.includes(globalThis.window.location.pathname)) {
        globalThis.window.location.href = '/auth/sign-in';
    }
};

type RetryConfig = AxiosRequestConfig & { _retry?: boolean };

const handleQueuedRequest = (originalRequest: RetryConfig) =>
    new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
    }).then((token) => {
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
        return axiosInstance(originalRequest);
    });

// One shared refresh (also used by the SSE stream when it gets a 401).
export const refreshTokens = async (): Promise<string> => {
    const refreshToken = cookies.get('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');
    const response = await axios.post<GlobalApiResponse<AuthResponse>>(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { withCredentials: true },
    );
    const data = response.data.data;
    if (!response.data.success || !data?.access_token) throw new Error('Refresh token expired');
    setAuthCookies(data.access_token, data.refresh_token, data.expires_in);
    return data.access_token;
};

const handleRefreshToken = async (originalRequest: RetryConfig) => {
    try {
        const newAccessToken = await refreshTokens();
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newAccessToken}` };
        processQueue(null, newAccessToken);
        return axiosInstance(originalRequest);
    } catch (refreshError) {
        processQueue(refreshError as Error, null);
        redirectToLogin();
        throw refreshError;
    }
};

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest: RetryConfig = error.config;
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            if (shouldSkipRefresh(originalRequest.url)) throw error;
            if (isRefreshing) return handleQueuedRequest(originalRequest);
            originalRequest._retry = true;
            isRefreshing = true;
            try {
                return await handleRefreshToken(originalRequest);
            } finally {
                isRefreshing = false;
            }
        }
        throw error;
    },
);
