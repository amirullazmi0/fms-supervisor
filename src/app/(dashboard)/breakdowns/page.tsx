'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import PageLoading from '@/components/custom/page-loading';

const BreakdownsView = dynamic(() => import('./breakdowns.view'), {
    ssr: false,
    loading: () => <PageLoading />,
});

export default function Page() {
    return (
        <Suspense fallback={<PageLoading />}>
            <BreakdownsView />
        </Suspense>
    );
}
