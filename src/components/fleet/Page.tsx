'use client';
// Bagian halaman yang seragam di semua menu: judul + deskripsi + aksi, kotak kosong yang jelas
// (ikon, judul, aksi), dan skeleton saat memuat.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({
    title,
    description,
    actions,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
            <div className="min-w-0">
                <h2 className="m-0 text-lg font-semibold tracking-tight md:text-xl">{title}</h2>
                {description && (
                    <p className="m-0 mt-0.5 text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

export function EmptyState({
    icon: Icon,
    title,
    children,
    action,
    className,
}: {
    icon?: LucideIcon;
    title: ReactNode;
    children?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center',
                className,
            )}
        >
            {Icon && <Icon className="size-8 text-muted-foreground" />}
            <b className="text-sm">{title}</b>
            {children && <p className="m-0 max-w-md text-sm text-muted-foreground">{children}</p>}
            {action && <div className="mt-1">{action}</div>}
        </div>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

// Kotak isi dengan judul kecil + aksi kanan (dipakai di Beranda & halaman lain).
export function Panel({
    title,
    hint,
    action,
    children,
    className,
}: {
    title: ReactNode;
    hint?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn('flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4', className)}
        >
            <header className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="m-0 truncate text-sm font-semibold">{title}</h3>
                    {hint && <p className="m-0 truncate text-xs text-muted-foreground">{hint}</p>}
                </div>
                {action}
            </header>
            {children}
        </section>
    );
}
