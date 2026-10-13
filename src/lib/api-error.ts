import { AxiosErrorResponse } from '@/types/api/responses';

// Readable message from an API error: validation map, list, string, then message.
export function apiErrorMessage(
    error: AxiosErrorResponse | null | undefined,
    fallback = 'Something went wrong',
): string {
    const data = error?.response?.data;
    const detail = data?.error;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        const parts = Object.values(detail).filter(Boolean);
        if (parts.length) return parts.join(', ');
    }
    if (Array.isArray(detail) && detail.length) return detail.join(', ');
    if (data?.message) return data.message;
    if (typeof detail === 'string' && detail) return detail;
    return error?.message || fallback;
}

// Message of anything a mutation/query may throw (axios error or plain Error).
export function errText(err: unknown, fallback = 'Something went wrong'): string {
    const e = err as AxiosErrorResponse;
    if (e && typeof e === 'object' && 'isAxiosError' in e) return apiErrorMessage(e, fallback);
    return (err as Error)?.message || fallback;
}
