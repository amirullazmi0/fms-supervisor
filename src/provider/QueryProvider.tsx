'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type LoadingContextType = {
    loading: boolean;
    setLoading: (v: boolean) => void;
};

export const LoadingContext = createContext<LoadingContextType>({ loading: false, setLoading: () => {} });

export default function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnMount: false, retry: 1 } },
            }),
    );
    const [loading, setLoading] = useState<boolean>(false);
    const value = useMemo(() => ({ loading, setLoading }), [loading]);
    return (
        <QueryClientProvider client={queryClient}>
            <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
        </QueryClientProvider>
    );
}
