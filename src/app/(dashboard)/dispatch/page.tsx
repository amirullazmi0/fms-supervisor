'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import PageLoading from '@/components/custom/page-loading';

const DispatchView = dynamic(() => import('./dispatch.view'), {
    ssr: false,
    loading: () => <PageLoading />,
});

export default function Page() {
    return (
        <Suspense fallback={<PageLoading />}>
            <DispatchView />
        </Suspense>
    );
}
