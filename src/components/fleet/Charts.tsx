'use client';
// Small dashboard charts (plain HTML/SVG, no chart library): vertical bars, ranking bars, donut.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { fmtNum } from '@/lib/format';
import { Tip } from '@/components/ui/misc';
import { InfoTip } from '@/components/ui/info-tip';

// Series colors (same tokens as the rest of the UI).
export const SERIES = [
    'var(--brand)',
    'var(--info)',
    'var(--success)',
    'var(--site-unloading)',
    'var(--warning)',
    'var(--muted-foreground)',
];

function niceMax(v: number): number {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) ?? v;
}

export interface Bar {
    key: string;
    label: string; // axis label (short)
    value: number;
    tip?: ReactNode; // tooltip content
}

// Vertical bars with a 4-step grid. Labels thin out when there are many bars.
export function BarChart({
    bars,
    color = SERIES[0],
    format = (v) => fmtNum(v),
    height = 200,
    empty = 'Belum ada data.',
}: {
    bars: Bar[];
    color?: string;
    format?: (v: number) => string;
    height?: number;
    empty?: string;
}) {
    const max = niceMax(Math.max(0, ...bars.map((b) => b.value)));
    const every = Math.max(1, Math.ceil(bars.length / 12));
    if (bars.every((b) => b.value === 0))
        return (
            <div
                className="grid place-items-center text-sm text-muted-foreground"
                style={{ height }}
            >
                {empty}
            </div>
        );
    return (
        <div className="flex gap-2" style={{ height }}>
            <div className="flex w-10 shrink-0 flex-col justify-between pb-5 text-right text-[10.5px] text-muted-foreground tabular-nums">
                {[4, 3, 2, 1, 0].map((i) => (
                    <span key={i} className="leading-none">
                        {format((max * i) / 4)}
                    </span>
                ))}
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col">
                <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <i key={i} className="border-t border-dashed border-border" />
                    ))}
                </div>
                <div className="relative flex flex-1 items-end gap-[3px]">
                    {bars.map((b) => (
                        <Tip key={b.key} label={b.tip ?? `${b.label}: ${format(b.value)}`}>
                            <div className="group flex h-full min-w-0 flex-1 items-end">
                                <div
                                    className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80"
                                    style={{
                                        height: `${(b.value / max) * 100}%`,
                                        minHeight: b.value > 0 ? 2 : 0,
                                        background: color,
                                    }}
                                />
                            </div>
                        </Tip>
                    ))}
                </div>
                <div className="flex h-5 gap-[3px] pt-1">
                    {bars.map((b, i) => (
                        <span
                            key={b.key}
                            className="min-w-0 flex-1 truncate text-center text-[10.5px] text-muted-foreground"
                        >
                            {i % every === 0 ? b.label : ''}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Ranking: label + horizontal bar + value, biggest first.
export function RankBars({
    rows,
    color = SERIES[0],
    format = (v) => fmtNum(v),
    limit = 6,
    empty = 'Belum ada data.',
}: {
    rows: { key: string; label: string; sub?: string | null; value: number }[];
    color?: string;
    format?: (v: number) => string;
    limit?: number;
    empty?: string;
}) {
    const list = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
    const max = Math.max(1, ...list.map((r) => r.value));
    if (list.length === 0 || list[0].value === 0)
        return <p className="m-0 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
    return (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {list.map((r, i) => (
                <li key={r.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="flex min-w-0 items-baseline gap-2">
                            <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                                {i + 1}
                            </span>
                            <b className="truncate font-medium">{r.label}</b>
                            {r.sub && (
                                <span className="truncate text-xs text-muted-foreground">
                                    {r.sub}
                                </span>
                            )}
                        </span>
                        <b className="shrink-0 tabular-nums">{format(r.value)}</b>
                    </div>
                    <div className="ml-6 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${(r.value / max) * 100}%`, background: color }}
                        />
                    </div>
                </li>
            ))}
        </ol>
    );
}

// Donut with a legend; center shows the total.
export function Donut({
    slices,
    center,
    empty = 'Belum ada data.',
}: {
    slices: { key: string; label: string; value: number }[];
    center: ReactNode;
    empty?: string;
}) {
    const total = slices.reduce((s, x) => s + x.value, 0);
    if (total === 0)
        return <p className="m-0 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
    const R = 15.9155; // circumference = 100
    const pcts = slices.map((s) => (s.value / total) * 100);
    const offsets = pcts.map((_, i) => 25 - pcts.slice(0, i).reduce((a, b) => a + b, 0));
    return (
        <div className="flex flex-wrap items-center gap-5">
            <div className="relative size-36 shrink-0">
                <svg viewBox="0 0 42 42" className="size-full" aria-hidden="true">
                    <circle
                        cx="21"
                        cy="21"
                        r={R}
                        fill="none"
                        stroke="var(--muted)"
                        strokeWidth="5"
                    />
                    {slices.map((s, i) => (
                        <circle
                            key={s.key}
                            cx="21"
                            cy="21"
                            r={R}
                            fill="none"
                            stroke={SERIES[i % SERIES.length]}
                            strokeWidth="5"
                            strokeDasharray={`${pcts[i]} ${100 - pcts[i]}`}
                            strokeDashoffset={offsets[i]}
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
            </div>
            <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-2 p-0 text-[13px]">
                {slices.map((s, i) => (
                    <li key={s.key} className="flex items-center gap-2">
                        <i
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ background: SERIES[i % SERIES.length] }}
                        />
                        <span className="min-w-0 flex-1 truncate">{s.label}</span>
                        <b className="tabular-nums">{fmtNum(s.value)}</b>
                        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                            {Math.round((s.value / total) * 100)}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// Card shell for a chart: title, optional hint on the right.
export function ChartCard({
    title,
    hint,
    children,
    className,
    info,
}: {
    title: ReactNode;
    info?: string; // id isi tombol info (lib/help.ts)
    hint?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn('flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4', className)}
        >
            <header className="flex items-baseline justify-between gap-2">
                <h2 className="m-0 flex items-center gap-1.5 text-sm font-semibold">
                    {title}
                    {info && <InfoTip id={info} />}
                </h2>
                {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
            </header>
            {children}
        </section>
    );
}
