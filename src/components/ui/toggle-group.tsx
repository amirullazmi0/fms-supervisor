import type { ComponentProps } from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

// Pilihan satu-dari-beberapa yang ringkas (Peta/Satelit, 1×/4×/16×, filter). Yang aktif kuning.
export function ToggleGroup({
    className,
    size = 'default',
    ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root> & { size?: 'sm' | 'default' }) {
    return (
        <ToggleGroupPrimitive.Root
            data-slot="toggle-group"
            data-size={size}
            className={cn(
                'group/tg inline-flex w-fit items-center gap-1 rounded-xl border bg-card p-1',
                className,
            )}
            {...props}
        />
    );
}

export function ToggleGroupItem({
    className,
    ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
    return (
        <ToggleGroupPrimitive.Item
            data-slot="toggle-group-item"
            className={cn(
                "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-brand data-[state=on]:font-semibold data-[state=on]:text-brand-foreground group-data-[size=default]/tg:h-8 group-data-[size=sm]/tg:h-7 group-data-[size=sm]/tg:px-2.5 group-data-[size=sm]/tg:text-xs [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        />
    );
}
