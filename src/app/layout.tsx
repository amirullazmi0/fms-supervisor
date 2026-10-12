import type { Metadata } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import QueryProvider from '@/provider/QueryProvider';
import AuthSyncProvider from '@/provider/AuthSyncProvider';
import { ToastProvider } from '@/components/fleet/Toasts';

export const metadata: Metadata = {
    title: 'FMS',
    description: 'Pelacakan truk FMC150, shift, dan laporan ritase',
    icons: { icon: '/favicon.svg' },
};

// Theme before React runs (default light; dark only when chosen), so the page does not flash.
const themeScript = process.env.NEXT_PUBLIC_DARK_MODE !== 'true' ? '' : `try{var t=localStorage.getItem('fmc.theme');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="id" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
                />
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body suppressHydrationWarning>
                <NuqsAdapter>
                    <QueryProvider>
                        <ToastProvider>
                            <AuthSyncProvider>{children}</AuthSyncProvider>
                        </ToastProvider>
                    </QueryProvider>
                </NuqsAdapter>
            </body>
        </html>
    );
}
