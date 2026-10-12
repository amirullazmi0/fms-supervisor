import { AxiosError } from 'axios';

export interface GlobalApiResponse<T = unknown> {
    message: string;
    success: boolean;
    data?: T;
    meta?: {
        total_data: number;
        total_page: number;
        current_page: number;
        limit: number;
    };
}

export type AxiosErrorResponse = AxiosError<ErrorResponse>;

// `error` is a string, a list, or (validation) a map of field -> message.
export interface ErrorResponse {
    error: string | string[] | Record<string, string> | null;
    message: string;
}
