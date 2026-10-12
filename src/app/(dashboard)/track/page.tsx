'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import PageLoading from '@/components/custom/page-loading';

// Maps (Leaflet) need the browser, so the view renders on the client only.
const TrackView = dynamic(() => import('./track.view'), { ssr: false, loading: () => <PageLoading /> });

export default function Page() {
    return (
        <Suspense fallback={<PageLoading />}>
            <TrackView />
        </Suspense>
    );
}
