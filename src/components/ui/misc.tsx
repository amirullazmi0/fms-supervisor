// Komponen kecil yang dipakai di banyak halaman: tabel, angka ringkasan, baris label–nilai, kosong, dll.
import type { ComponentProps, ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import type { BadgeVariant } from './badge';
import type { Status } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/format';

export function Separator({
    className,
    vertical = false,
}: {
    className?: string;
    vertical?: boolean;
}) {
    return (
        <div
            role="separator"
            className={cn(
                'shrink-0 bg-border',
                vertical ? 'h-full w-px' : 'h-px w-full',
                className,
            )}
        />
    );
}

// ---------- Tabel (geser horizontal di kartunya bila sempit) ----------
export function Table({ className, ...props }: ComponentProps<'table'>) {
    return (
        <div className="relative w-full overflow-x-auto">
            <table className={cn('w-full caption-bottom text-[13px]', className)} {...props} />
        </div>
    );
}
export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
    return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}
export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
    return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}
export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
    return (
        <tr
            className={cn(
                'border-b transition-colors data-[state=selected]:bg-brand-soft',
                className,
            )}
            {...props}
        />
    );
}
export function TableHead({ className, ...props }: ComponentProps<'th'>) {
    return (
        <th
            className={cn(
                'h-9 whitespace-nowrap px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                className,
            )}
            {...props}
        />
    );
}
export function TableCell({ className, ...props }: ComponentProps<'td'>) {
    return (
        <td className={cn('whitespace-nowrap px-3 py-2.5 align-middle', className)} {...props} />
    );
}

// ---------- Angka ringkasan ----------
export function Stat({
    label,
    value,
    unit,
    sub,
    className,
    big = false,
}: {
    label: ReactNode;
    value: ReactNode;
    unit?: string;
    sub?: ReactNode;
    className?: string;
    big?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card px-3.5 py-3',
                className,
            )}
        >
            <span className="truncate text-xs text-muted-foreground">{label}</span>
            <span
                className={cn(
                    'truncate font-semibold tabular-nums tracking-tight',
                    big ? 'text-2xl' : 'text-lg',
                )}
            >
                {value}
                {unit && (
                    <small className="ml-1 text-xs font-normal text-muted-foreground">{unit}</small>
                )}
            </span>
            {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
        </div>
    );
}

// ---------- Baris label kiri, nilai kanan ----------
export function KV({ rows, className }: { rows: [ReactNode, ReactNode][]; className?: string }) {
    return (
        <dl className={cn('flex flex-col', className)}>
            {rows.map(([k, v], i) => (
                <div
                    key={i}
                    className="flex justify-between gap-4 border-b py-2 text-[13.5px] last:border-0"
                >
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="m-0 min-w-0 text-right font-medium [overflow-wrap:anywhere]">
                        {v}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

// ---------- Kosong / info ----------
export function Empty({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p className={cn('m-0 text-[13px] leading-relaxed text-muted-foreground', className)}>
            {children}
        </p>
    );
}

export function Note({
    children,
    tone = 'warning',
    className,
}: {
    children: ReactNode;
    tone?: 'warning' | 'info' | 'danger';
    className?: string;
}) {
    const t = {
        warning: 'bg-warning-soft text-warning',
        info: 'bg-info-soft text-info',
        danger: 'bg-danger-soft text-destructive',
    }[tone];
    return <div className={cn('rounded-lg px-3 py-2 text-[13px]', t, className)}>{children}</div>;
}

// ---------- Status unit ----------
const STATUS_VARIANT: Record<Status, BadgeVariant> = {
    moving: 'info',
    idle: 'warning',
    parked: 'muted',
    offline: 'destructive',
};
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
    return (
        <Badge variant={STATUS_VARIANT[status]} className={className}>
            {STATUS_LABEL[status]}
        </Badge>
    );
}

// ---------- Front loading / dumping ----------
// Titik: L (front loading, hijau), U (dumping, oranye), atau tanpa peran (biru, master titik).
export function SiteDot({
    type,
    className,
}: {
    type?: 'loading' | 'unloading' | null;
    className?: string;
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold text-white',
                type === 'loading'
                    ? 'bg-site-loading'
                    : type === 'unloading'
                      ? 'bg-site-unloading'
                      : 'bg-info',
                className,
            )}
        >
            {type === 'loading' ? (
                'L'
            ) : type === 'unloading' ? (
                'U'
            ) : (
                <MapPin className="size-[60%]" />
            )}
        </span>
    );
}

export function RoutePair({
    from,
    to,
    className,
}: {
    from: string;
    to: string;
    className?: string;
}) {
    return (
        <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[12.5px]', className)}>
            <SiteDot type="loading" className="size-4 text-[9px]" />
            <span className="truncate">{from}</span>
            <span className="text-muted-foreground" aria-hidden="true">
                →
            </span>
            <SiteDot type="unloading" className="size-4 text-[9px]" />
            <span className="truncate">{to}</span>
        </span>
    );
}

// ---------- Tooltip ----------
export function Tip({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <TooltipPrimitive.Provider delayDuration={300}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        sideOffset={6}
                        className="z-[2000] rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground shadow-md animate-in fade-in-0 zoom-in-95"
                    >
                        {label}
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}

// ---------- Avatar huruf awal ----------
export function Avatar({ name, className }: { name: string; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-grid size-8 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-brand-foreground',
                className,
            )}
        >
            {(name || '?').slice(0, 1).toUpperCase()}
        </span>
    );
}
