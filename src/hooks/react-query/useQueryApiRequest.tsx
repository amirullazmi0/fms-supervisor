'use client';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useContext, useEffect } from 'react';
import { constructUrl } from '@/data-services/utils/constructUrl';
import { allQueries } from '@/data-services/queries';
import { LoadingContext } from '@/provider/QueryProvider';
import { axiosInstance } from '@/lib/axios';
import { apiErrorMessage } from '@/lib/api-error';
import { AxiosErrorResponse } from '@/types/api/responses';
import { toast } from 'sonner';

type QueryApiRequestProps<T> = {
    key: keyof typeof allQueries;
    params?: Record<string, unknown>;
    queries?: Record<string, unknown>;
    options?: Omit<UseQueryOptions<T, AxiosErrorResponse>, 'queryKey' | 'queryFn'>;
    onSuccess?: (data: T) => void;
    config?: {
        showLoading?: boolean;
        successNotification?: boolean;
        errorNotification?: boolean;
        successNotificationMessage?: string;
        errorNotificationMessage?: string;
    };
};

const useQueryApiRequest = <T,>({
    key,
    params,
    queries,
    options,
    config = { showLoading: false, successNotification: false, errorNotification: true },
    onSuccess,
}: QueryApiRequestProps<T>) => {
    const queryKey = [key, params, queries];
    const { setLoading } = useContext(LoadingContext);

    const queryFn = async (): Promise<T> => {
        let url = allQueries[key];
        url = constructUrl(url, { query: params as Record<string, string> | undefined });
        const response = await axiosInstance.get(url, { params: queries });
        return response.data;
    };

    const queryFetch = useQuery<T, AxiosErrorResponse>({ queryKey, queryFn, ...options });

    useEffect(() => {
        if (config.showLoading) {
            if (queryFetch.isLoading) setLoading(true);
            if (queryFetch.isError || queryFetch.isSuccess) setLoading(false);
        }
        if (queryFetch.isError && config.errorNotification) {
            toast.error(config.errorNotificationMessage ?? apiErrorMessage(queryFetch.error, 'Gagal ngambil data'));
        }
        if (queryFetch.isSuccess) {
            if (onSuccess && queryFetch.data) onSuccess(queryFetch.data);
            if (config.successNotification) {
                const msg =
                    config.successNotificationMessage ??
                    (queryFetch.data && typeof queryFetch.data === 'object' && 'message' in queryFetch.data
                        ? (queryFetch.data as { message?: string }).message
                        : undefined) ??
                    'Data loaded';
                toast.success(msg);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryFetch.isLoading, queryFetch.isError, queryFetch.isSuccess, queryFetch.data, queryFetch.error]);

    return queryFetch;
};

export default useQueryApiRequest;
