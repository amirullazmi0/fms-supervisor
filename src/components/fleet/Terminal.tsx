'use client';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Send } from 'lucide-react';
import { fmtTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface TermLine {
    time: number;
    dir: 'in' | 'out' | 'sys' | 'err';
    text: string;
}

const TONE: Record<TermLine['dir'], string> = {
    in: 'text-zinc-100',
    out: 'text-amber-300',
    sys: 'text-zinc-500',
    err: 'text-red-400',
};

// Panel log kecil (perintah GPRS). Selalu gelap seperti terminal.
export function Terminal({
    lines,
    empty,
    tall = false,
}: {
    lines: TermLine[];
    empty: string;
    tall?: boolean;
}) {
    const ref = useRef<HTMLPreElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [lines]);
    return (
        <pre
            ref={ref}
            aria-live="polite"
            className={cn(
                'm-0 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950 p-3 font-mono text-[12px] leading-relaxed',
                tall ? 'h-80' : 'h-48',
            )}
        >
            {lines.length === 0 && <span className={TONE.sys}>{empty}</span>}
            {lines.map((l, i) => (
                <span key={`${l.time}-${i}`} className={TONE[l.dir]}>
                    <span className="text-zinc-500">{fmtTime(l.time)}</span>{' '}
                    {l.dir === 'out' ? '> ' : ''}
                    {l.text}
                    {'\n'}
                </span>
            ))}
        </pre>
    );
}

// Tombol perintah cepat + input bebas.
export function CommandBox({
    quick,
    placeholder,
    onSend,
    disabled = false,
}: {
    quick: string[];
    placeholder: string;
    onSend: (cmd: string) => void;
    disabled?: boolean;
}) {
    const [value, setValue] = useState('');
    const submit = (e: FormEvent) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        onSend(v);
        setValue('');
    };
    return (
        <form className="flex flex-col gap-2" onSubmit={submit}>
            <div className="flex flex-wrap gap-1.5">
                {quick.map((c) => (
                    <Button
                        key={c}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                        disabled={disabled}
                        onClick={() => onSend(c)}
                    >
                        {c}
                    </Button>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    className="font-mono"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    autoComplete="off"
                    aria-label="Perintah"
                    disabled={disabled}
                />
                <Button type="submit" disabled={disabled}>
                    <Send /> Kirim
                </Button>
            </div>
        </form>
    );
}
