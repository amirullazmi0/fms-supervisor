'use client';
import type { ReactNode } from 'react';
import StreamProvider from '@/provider/StreamProvider';
import Layout from '@/components/fleet/Layout';

// Every dashboard page shares one live connection (StreamProvider) and the sidebar layout.
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <StreamProvider>
            <Layout>{children}</Layout>
        </StreamProvider>
    );
}
