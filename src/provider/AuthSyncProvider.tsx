'use client';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/react-query/useAuth';

// Loads the profile on app start so the store (permissions) is fresh.
export default function AuthSyncProvider({ children }: { children: ReactNode }) {
    useAuth();
    return <>{children}</>;
}
