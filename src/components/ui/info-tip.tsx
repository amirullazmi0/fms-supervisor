'use client';
// Tombol info (i): arahkan kursor untuk ringkasan, klik untuk penjelasan lengkap + istilah (tetap
// terbuka sampai diklik di luar). Isi dari HELP (lib/help.ts). Tidak tampil bila fitur
// "Info & panduan" (info_tips) dimatikan di menu Fitur, atau id belum punya isi.
import { useRef, useState } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Info } from 'lucide-react';
import { HELP } from '@/lib/help';
import { useInfoTips } from '@/lib/info';
import { cn } from '@/lib/utils';

export function InfoTip({ id, className }: { id: string; className?: string }) {
    const enabled = useInfoTips();
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
    const entry = HELP[id];
    if (!enabled || !entry) return null;

    const hover = (on: boolean) => {
        if (leave.current) clearTimeout(leave.current);
        if (pinned) return;
        if (on) setOpen(true);
        else leave.current = setTimeout(() => setOpen(false), 150);
    };
    const full = pinned && (entry.body?.length || entry.terms?.length);

    return (
        <PopoverPrimitive.Root
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) setPinned(false);
            }}
        >
            <PopoverPrimitive.Trigger asChild>
                <button
                    type="button"
                    aria-label={`Info: ${entry.title}`}
                    onMouseEnter={() => hover(true)}
                    onMouseLeave={() => hover(false)}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPinned(true);
                        setOpen(true);
                    }}
                    className={cn(
                        'inline-grid size-5 shrink-0 place-items-center rounded-full align-middle text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
                        open && 'bg-muted text-foreground',
                        className,
                    )}
                >
                    <Info className="size-3.5" />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    onMouseEnter={() => hover(true)}
                    onMouseLeave={() => hover(false)}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="z-[2100] w-[min(22rem,calc(100vw-24px))] rounded-xl border bg-popover p-3.5 text-[13px] leading-relaxed text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
                >
                    <p className="m-0 font-semibold">{entry.title}</p>
                    <p className="m-0 mt-1 text-muted-foreground">{entry.summary}</p>
                    {full ? (
                        <>
                            {entry.body?.map((p) => (
                                <p key={p} className="m-0 mt-2">
                                    {p}
                                </p>
                            ))}
                            {entry.terms && (
                                <dl className="m-0 mt-2.5 flex flex-col gap-1 border-t pt-2.5">
                                    {entry.terms.map(([t, d]) => (
                                        <div key={t}>
                                            <dt className="inline font-semibold">{t}: </dt>
                                            <dd className="m-0 inline text-muted-foreground">
                                                {d}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                        </>
                    ) : entry.body?.length || entry.terms?.length ? (
                        <p className="m-0 mt-2 text-xs text-muted-foreground">
                            Klik untuk penjelasan lengkap.
                        </p>
                    ) : null}
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
