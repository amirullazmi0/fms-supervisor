'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import PageLoading from '@/components/custom/page-loading';

// Maps (Leaflet) need the browser, so the view renders on the client only.
const ShiftsView = dynamic(() => import('./shifts.view'), { ssr: false, loading: () => <PageLoading /> });

export default function Page() {
    return (
        <Suspense fallback={<PageLoading />}>
            <ShiftsView />
        </Suspense>
    );
}
