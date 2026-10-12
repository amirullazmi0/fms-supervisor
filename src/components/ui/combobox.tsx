// Combobox: dropdown yang bisa dicari (shadcn: Popover + Command/cmdk).
// Dipakai buat driver, truk, rute — datanya bisa puluhan.
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Command as CommandPrimitive } from 'cmdk';
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------- Popover ----------
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ className, align = 'start', sideOffset = 4, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[2000] w-72 rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

// ---------- Command ----------
export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive className={cn('flex h-full w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground', className)} {...props} />;
}

export function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-10 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input className={cn('flex h-10 w-full bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground max-md:text-base', className)} {...props} />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn('max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden p-1', className)} {...props} />;
}

export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground" {...props} />;
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

// ---------- Combobox siap pakai ----------
export interface ComboOption {
  value: string;
  label: string;
  hint?: string; // teks kecil di kanan (mis. "di Sore · Rute B", "terakhir")
  keywords?: string[]; // tambahan kata buat pencarian
  disabled?: boolean;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Pilih…',
  searchPlaceholder = 'Cari…',
  empty = 'Nggak ketemu.',
  className,
  size = 'default',
  disabled,
  icon,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  empty?: string;
  className?: string;
  size?: 'sm' | 'default';
  disabled?: boolean;
  icon?: ReactNode;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn(
            'flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50',
            size === 'sm' ? 'h-8' : 'h-9 max-md:h-10',
            className,
          )}
        >
          <span className={cn('flex min-w-0 items-center gap-2 truncate', !current && 'text-muted-foreground')}>
            {icon}
            <span className="truncate">{current ? current.label : placeholder}</span>
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={`${o.label} ${o.value}`}
                keywords={o.keywords}
                disabled={o.disabled}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <CheckIcon className={cn('size-4', o.value === value ? 'opacity-100' : 'opacity-0')} />
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && <span className="ml-2 shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
