import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-brand/40 aria-invalid:border-destructive max-md:h-10 max-md:text-base';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(inputClass, 'h-auto min-h-16 py-2', className)} {...props} />;
}

// Kolom cari dengan ikon kaca pembesar.
export function SearchInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <label className={cn('relative flex min-w-0 items-center', className)}>
      <svg className="pointer-events-none absolute left-3 size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" className={cn(inputClass, 'pl-9')} {...props} />
    </label>
  );
}
