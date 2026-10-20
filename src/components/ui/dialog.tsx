import type { ComponentProps } from 'react';
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from 'radix-ui';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

const overlay =
    'fixed inset-0 z-[2000] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';
const panel =
    'fixed left-1/2 top-1/2 z-[2000] grid grid-cols-1 max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-card p-5 [&>*]:min-w-0 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-lg';

// ---------- Dialog ----------
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
    className,
    children,
    showClose = true,
    ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className={overlay} />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                className={cn(panel, className)}
                {...props}
            >
                {children}
                {showClose && (
                    <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 opacity-60 transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none">
                        <XIcon className="size-4" />
                        <span className="sr-only">Tutup</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
    return <div className={cn('flex flex-col gap-1.5 pr-6', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
            {...props}
        />
    );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            className={cn('text-lg font-semibold leading-none', className)}
            {...props}
        />
    );
}

export function DialogDescription({
    className,
    ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            className={cn('text-sm text-muted-foreground', className)}
            {...props}
        />
    );
}

// ---------- Konfirmasi (AlertDialog) ----------
// Dipakai untuk aksi yang tidak dapat dibatalkan: hapus, selesaikan shift, dll.
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Ya, lanjut',
    cancelLabel = 'Batal',
    destructive = false,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
}) {
    return (
        <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <AlertPrimitive.Portal>
                <AlertPrimitive.Overlay className={overlay} />
                <AlertPrimitive.Content className={cn(panel, 'sm:max-w-md')}>
                    <div className="flex flex-col gap-1.5">
                        <AlertPrimitive.Title className="text-lg font-semibold">
                            {title}
                        </AlertPrimitive.Title>
                        {description && (
                            <AlertPrimitive.Description className="text-sm text-muted-foreground">
                                {description}
                            </AlertPrimitive.Description>
                        )}
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <AlertPrimitive.Cancel className={buttonVariants({ variant: 'outline' })}>
                            {cancelLabel}
                        </AlertPrimitive.Cancel>
                        <AlertPrimitive.Action
                            className={buttonVariants({
                                variant: destructive ? 'destructive' : 'default',
                            })}
                            onClick={onConfirm}
                        >
                            {confirmLabel}
                        </AlertPrimitive.Action>
                    </div>
                </AlertPrimitive.Content>
            </AlertPrimitive.Portal>
        </AlertPrimitive.Root>
    );
}

// ---------- Sheet (panel geser dari samping, untuk menu di HP) ----------
export function SheetContent({
    className,
    children,
    side = 'left',
    ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { side?: 'left' | 'right' }) {
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className={overlay} />
            <DialogPrimitive.Content
                className={cn(
                    'fixed inset-y-0 z-[2000] flex h-full w-[min(300px,85vw)] flex-col shadow-xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300',
                    side === 'left'
                        ? 'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
                        : 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
                    className,
                )}
                {...props}
            >
                {children}
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
}
