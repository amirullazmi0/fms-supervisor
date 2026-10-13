'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { fmtHm, fmtNum, fmtTime } from '@/lib/format';

export interface ChartPoint {
    t: number;
    y: number;
}

function useWidth(ref: RefObject<HTMLElement | null>): number {
    const [w, setW] = useState(400);
    useEffect(() => {
        if (!ref.current) return;
        const ro = new ResizeObserver(([e]) =>
            setW(Math.max(280, Math.round(e.contentRect.width))),
        );
        ro.observe(ref.current);
        return () => ro.disconnect();
    }, [ref]);
    return w;
}

function niceMax(v: number): number {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) ?? v;
}

const H = 170;
const M = { l: 40, r: 12, t: 10, b: 22 };
const GAP = 5 * 60e3; // jeda data > 5 menit = garis diputus
const ANCHORS = ['start', 'middle', 'middle', 'middle', 'end'] as const;

interface Props {
    title: string;
    unit: string;
    points: ChartPoint[];
    dec?: number;
    minZero?: boolean;
}

// Satu seri, satu sumbu, dengan crosshair + tooltip.
export default function LineChart({ title, unit, points, dec = 0, minZero = true }: Props) {
    const ref = useRef<HTMLElement>(null);
    const W = useWidth(ref);
    const [hover, setHover] = useState<ChartPoint | null>(null);
    const last = points[points.length - 1];

    const geo = useMemo(() => {
        if (points.length < 2) return null;
        const t0 = points[0].t;
        const t1 = points[points.length - 1].t;
        const ys = points.map((p) => p.y);
        const lo = minZero ? 0 : Math.floor(Math.min(...ys) * 0.98 * 10) / 10;
        const hi = minZero
            ? niceMax(Math.max(...ys) * 1.05)
            : Math.ceil(Math.max(...ys) * 1.02 * 10) / 10 || 1;
        const x = (t: number) => M.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - M.l - M.r);
        const y = (v: number) => M.t + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * (H - M.t - M.b);
        const xy = (p: ChartPoint) => `${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`;

        let line = '';
        let area = '';
        let seg: ChartPoint[] = [];
        const flush = () => {
            if (seg.length > 1) {
                line += `M${seg.map(xy).join('L')}`;
                area += `M${x(seg[0].t).toFixed(1)},${y(lo)}L${seg.map(xy).join('L')}L${x(seg[seg.length - 1].t).toFixed(1)},${y(lo)}Z`;
            }
            seg = [];
        };
        points.forEach((p, i) => {
            if (i && p.t - points[i - 1].t > GAP) flush();
            seg.push(p);
        });
        flush();

        const steps = [0, 1, 2, 3, 4];
        return {
            t0,
            t1,
            x,
            y,
            line,
            area,
            yTicks: steps.map((i) => lo + ((hi - lo) * i) / 4),
            xTicks: steps.map((i) => t0 + ((t1 - t0) * i) / 4),
            tickDec: hi - lo < 5 ? 1 : 0,
        };
    }, [points, W, minZero]);

    const onMove = (e: PointerEvent<SVGRectElement>) => {
        if (!geo) return;
        const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
        const t =
            geo.t0 +
            ((((e.clientX - r.left) / r.width) * W - M.l) / (W - M.l - M.r)) * (geo.t1 - geo.t0);
        let best = points[0];
        for (const p of points) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
        setHover(best);
    };

    return (
        <figure className="relative m-0 flex flex-col gap-2" ref={ref}>
            <figcaption className="flex items-baseline justify-between gap-2 text-[13px] text-muted-foreground">
                <span>{title}</span>
                {last && (
                    <b className="font-mono text-sm text-foreground tabular-nums">
                        {fmtNum(last.y, dec)} {unit}
                    </b>
                )}
            </figcaption>
            <svg
                className="w-full overflow-visible"
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`${title}, ${points.length} titik data`}
            >
                {geo ? (
                    <>
                        <g className="stroke-border" strokeDasharray="2 3">
                            {geo.yTicks.map((v) => (
                                <line key={v} x1={M.l} x2={W - M.r} y1={geo.y(v)} y2={geo.y(v)} />
                            ))}
                        </g>
                        <g className="fill-muted-foreground text-[10px]">
                            {geo.yTicks.map((v) => (
                                <text key={v} x={M.l - 6} y={geo.y(v) + 3} textAnchor="end">
                                    {fmtNum(v, geo.tickDec)}
                                </text>
                            ))}
                            {geo.xTicks.map((t, i) => (
                                <text key={t} x={geo.x(t)} y={H - 4} textAnchor={ANCHORS[i]}>
                                    {fmtHm(t)}
                                </text>
                            ))}
                        </g>
                        <path d={geo.area} className="fill-info/10" />
                        <path
                            d={geo.line}
                            fill="none"
                            strokeWidth={2}
                            strokeLinejoin="round"
                            className="stroke-info"
                        />
                        <circle
                            cx={geo.x(last.t)}
                            cy={geo.y(last.y)}
                            r="4"
                            className="fill-info stroke-card"
                            strokeWidth={2}
                        />
                        {hover && (
                            <>
                                <line
                                    x1={geo.x(hover.t)}
                                    x2={geo.x(hover.t)}
                                    y1={M.t}
                                    y2={H - M.b}
                                    className="stroke-muted-foreground"
                                    strokeDasharray="3 3"
                                />
                                <circle
                                    cx={geo.x(hover.t)}
                                    cy={geo.y(hover.y)}
                                    r="4"
                                    className="fill-info stroke-card"
                                    strokeWidth={2}
                                />
                            </>
                        )}
                        <rect
                            fill="transparent"
                            className="cursor-crosshair"
                            x={M.l}
                            y="0"
                            width={W - M.l - M.r}
                            height={H}
                            onPointerMove={onMove}
                            onPointerLeave={() => setHover(null)}
                        />
                    </>
                ) : (
                    <text
                        x={W / 2}
                        y={H / 2}
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                    >
                        Belum cukup data di rentang ini
                    </text>
                )}
            </svg>
            {geo && hover && (
                <div
                    className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 font-mono text-[11px] text-primary-foreground shadow-md"
                    style={{
                        left: `${(geo.x(hover.t) / W) * 100}%`,
                        top: `${geo.y(hover.y) + 22}px`,
                    }}
                >
                    {fmtTime(hover.t)} · {fmtNum(hover.y, dec)} {unit}
                </div>
            )}
        </figure>
    );
}
