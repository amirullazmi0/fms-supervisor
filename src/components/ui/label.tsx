import type { ComponentProps, ReactNode } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
    return (
        <LabelPrimitive.Root
            data-slot="label"
            className={cn(
                'flex select-none items-center gap-2 text-[13px] font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                className,
            )}
            {...props}
        />
    );
}

// Label + kolom isian + keterangan, untuk form.
export function Field({
    label,
    hint,
    error,
    children,
    className,
    htmlFor,
}: {
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    children: ReactNode;
    className?: string;
    htmlFor?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <Label htmlFor={htmlFor} className="text-muted-foreground">
                {label}
            </Label>
            {children}
            {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}
