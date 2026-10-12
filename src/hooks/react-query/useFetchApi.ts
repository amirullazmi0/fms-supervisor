'use client';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { allQueries, AllQueryKeys } from '@/data-services/queries';
import { constructUrl } from '@/data-services/utils/constructUrl';
import { axiosInstance } from '@/lib/axios';
import { GlobalApiResponse } from '@/types/api/responses';

/**
 * Imperative GET through the same data-services keys and react-query cache as
 * useQueryApiRequest — for the few places that load on demand or in a loop
 * (several route histories at once, polling a place name, quiet refreshes).
 */
export default function useFetchApi() {
    const queryClient = useQueryClient();
    return useCallback(
        async <T,>(key: AllQueryKeys, params?: Record<string, string>, queries?: Record<string, unknown>): Promise<T | undefined> => {
            const res = await queryClient.fetchQuery<GlobalApiResponse<T>>({
                queryKey: [key, params, queries],
                queryFn: async () => {
                    const url = constructUrl(allQueries[key], { query: params });
                    return (await axiosInstance.get(url, { params: queries })).data;
                },
                staleTime: 0,
            });
            return res.data;
        },
        [queryClient],
    );
}
