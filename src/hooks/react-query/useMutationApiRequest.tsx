'use client';
import { allMutations, AllMutationKeys } from '@/data-services/mutations';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { constructUrl } from '@/data-services/utils/constructUrl';
import { AllQueryKeys } from '@/data-services/queries';
import { LoadingContext } from '@/provider/QueryProvider';
import { axiosInstance } from '@/lib/axios';
import { apiErrorMessage } from '@/lib/api-error';
import { AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { AxiosErrorResponse } from '@/types/api/responses';

// Components that show their own (more specific) toasts pass this as `config`.
export const SILENT = { showLoading: false, successNotification: false, errorNotification: false };

interface ApiResponse {
    message?: string;
}

/** T = Response type, V = Request body type (object or FormData) */
type MutationApiRequestProps<T, V> = {
    key: AllMutationKeys;
    params?: Record<string, string> | (() => Record<string, string>);
    queries?: Record<string, string | number | boolean>;
    options?: {
        onSuccess?: (data?: T, variables?: V) => void;
        onError?: (error?: AxiosErrorResponse) => void;
        onSettled?: () => void;
    };
    config?: {
        showLoading?: boolean;
        successNotification?: boolean;
        errorNotification?: boolean;
        successNotificationMessage?: string;
        errorNotificationMessage?: string;
    };
};

const useMutationApiRequest = <T, V>({
    key,
    queries,
    options,
    params,
    config = { showLoading: false, successNotification: true, errorNotification: true },
}: MutationApiRequestProps<T, V>) => {
    const queryClient = useQueryClient();
    const mutationConfig = allMutations[key];
    const { setLoading } = useContext(LoadingContext);

    // `params` may also travel with the variables as `{ __params }` (one hook, many rows).
    const mutationFn = async (data: V): Promise<T> => {
        const isFormData = data instanceof FormData;
        let body: unknown = data;
        let resolvedParams = typeof params === 'function' ? params() : params;
        if (data && typeof data === 'object' && !isFormData && '__params' in (data as object)) {
            const { __params, ...rest } = data as unknown as { __params: Record<string, string> };
            resolvedParams = { ...resolvedParams, ...__params };
            body = Object.keys(rest).length ? rest : undefined;
        }
        const url = constructUrl(mutationConfig.url, { query: resolvedParams });
        const requestConfig: AxiosRequestConfig = {
            url,
            method: mutationConfig.method,
            data: body,
            params: queries,
        };
        if (isFormData) requestConfig.headers = { 'Content-Type': 'multipart/form-data' };
        const response = await axiosInstance(requestConfig);
        return response.data;
    };

    return useMutation<T, AxiosErrorResponse, V>({
        mutationFn,
        onMutate: () => {
            if (config.showLoading) setLoading(true);
        },
        onSuccess: (data, variables) => {
            if (options?.onSuccess) options.onSuccess(data, variables);
            if (mutationConfig.refetchQueries) {
                mutationConfig.refetchQueries.forEach((queryKey: AllQueryKeys) => {
                    queryClient.refetchQueries({ queryKey: [queryKey] });
                });
            }
            if (config?.successNotification ?? true) {
                toast.success(
                    config?.successNotificationMessage ??
                        (data as ApiResponse)?.message ??
                        'Berhasil',
                );
            }
        },
        onError: (error) => {
            if (options?.onError) options.onError(error);
            if (config?.errorNotification ?? true) {
                toast.error(config?.errorNotificationMessage ?? apiErrorMessage(error));
            }
        },
        onSettled: () => {
            if (options?.onSettled) options.onSettled();
            if (config.showLoading) setLoading(false);
        },
    });
};

export default useMutationApiRequest;
