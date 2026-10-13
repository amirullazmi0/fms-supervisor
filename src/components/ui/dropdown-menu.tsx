import type { ComponentProps } from 'react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({
    className,
    sideOffset = 6,
    ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
    return (
        <MenuPrimitive.Portal>
            <MenuPrimitive.Content
                sideOffset={sideOffset}
                className={cn(
                    'z-[2000] min-w-[12rem] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                    className,
                )}
                {...props}
            />
        </MenuPrimitive.Portal>
    );
}

const item =
    "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export function DropdownMenuItem({
    className,
    variant,
    ...props
}: ComponentProps<typeof MenuPrimitive.Item> & { variant?: 'destructive' }) {
    return (
        <MenuPrimitive.Item
            className={cn(
                item,
                variant === 'destructive' &&
                    'text-destructive focus:bg-danger-soft focus:text-destructive',
                className,
            )}
            {...props}
        />
    );
}

export function DropdownMenuRadioItem({
    className,
    children,
    ...props
}: ComponentProps<typeof MenuPrimitive.RadioItem>) {
    return (
        <MenuPrimitive.RadioItem className={cn(item, 'pl-8', className)} {...props}>
            <span className="absolute left-2 flex size-4 items-center justify-center">
                <MenuPrimitive.ItemIndicator>
                    <CheckIcon className="size-4" />
                </MenuPrimitive.ItemIndicator>
            </span>
            {children}
        </MenuPrimitive.RadioItem>
    );
}

export function DropdownMenuLabel({
    className,
    ...props
}: ComponentProps<typeof MenuPrimitive.Label>) {
    return (
        <MenuPrimitive.Label
            className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)}
            {...props}
        />
    );
}

export function DropdownMenuSeparator({
    className,
    ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
    return (
        <MenuPrimitive.Separator
            className={cn('-mx-1 my-1 h-px bg-border', className)}
            {...props}
        />
    );
}
