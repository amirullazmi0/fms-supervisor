'use client';
// Notifikasi di pojok layar (sonner, toast-nya shadcn). API-nya tetap: useToast()({ title, body, level, actions }).
import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast as sonner } from 'sonner';

export type ToastAction = { label: string; to: string } | { label: string; onClick: () => void };

export interface ToastInput {
    title: string;
    body?: string;
    level?: 'info' | 'warn' | 'crit';
    actions?: ToastAction[];
}

type ToastFn = (t: ToastInput) => void;

const ToastCtx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const toast = useCallback<ToastFn>(
        (t) => {
            const [a, b] = t.actions ?? [];
            const run = (x: ToastAction) => () => ('to' in x ? router.push(x.to) : x.onClick());
            const opts = {
                description: t.body,
                duration: t.actions?.length ? 15000 : 6000,
                action: a ? { label: a.label, onClick: run(a) } : undefined,
                cancel: b ? { label: b.label, onClick: run(b) } : undefined,
            };
            if (t.level === 'crit') sonner.error(t.title, opts);
            else if (t.level === 'warn') sonner.warning(t.title, opts);
            else sonner(t.title, opts);
        },
        [router],
    );

    return (
        <ToastCtx.Provider value={toast}>
            {children}
            <Toaster
                position="bottom-right"
                visibleToasts={5}
                closeButton
                toastOptions={{
                    classNames: {
                        toast: '!bg-popover !text-popover-foreground !border-border !rounded-xl !shadow-lg',
                        description: '!text-muted-foreground',
                        actionButton: '!bg-primary !text-primary-foreground !rounded-md',
                        cancelButton: '!bg-secondary !text-secondary-foreground !rounded-md',
                        error: '[&_[data-icon]]:!text-destructive',
                        warning: '[&_[data-icon]]:!text-warning',
                    },
                }}
            />
        </ToastCtx.Provider>
    );
}

export const useToast = (): ToastFn => useContext(ToastCtx);

// Notifikasi sistem (kalau tab lagi nggak dilihat dan izin udah dikasih).
export function notify(title: string, body: string): void {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try {
            new Notification(title, { body });
        } catch {
            /* browser nolak, diabaikan */
        }
    }
}
