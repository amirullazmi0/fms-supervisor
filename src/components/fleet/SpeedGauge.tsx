'use client';
// Speedometer setengah lingkaran. Busur jadi merah kalau lewat batas kecepatan.
import { cn } from '@/lib/utils';

const W = 200;
const H = 118;
const CX = 100;
const CY = 100;
const R = 82;

function arc(fraction: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  const a = Math.PI * (1 - f);
  const x = CX + R * Math.cos(a);
  const y = CY - R * Math.sin(a);
  return `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

interface Props {
  speed: number | null;
  max?: number;
  limit?: number;
  stale?: boolean; // data udah lama, angka ditampilin redup
  className?: string;
}

export default function SpeedGauge({ speed, max = 120, limit = 80, stale = false, className }: Props) {
  const v = speed ?? 0;
  const over = v > limit;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg className={cn('w-full', stale && 'opacity-50', className)} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={speed == null ? 'Kecepatan belum ada data' : `Kecepatan ${v} kilometer per jam`}>
      <path d={arc(1)} fill="none" strokeWidth={14} strokeLinecap="round" className="stroke-muted" />
      {v > 0 && <path d={arc(v / max)} fill="none" strokeWidth={14} strokeLinecap="round" className={over ? 'stroke-destructive' : 'stroke-brand'} />}
      {ticks.map((t) => {
        const a = Math.PI * (1 - t);
        return (
          <text key={t} x={CX + (R + 13) * Math.cos(a)} y={CY - (R + 13) * Math.sin(a) + 3} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {Math.round(max * t)}
          </text>
        );
      })}
      <text x={CX} y={CY - 14} textAnchor="middle" className={cn('text-[38px] font-bold tabular-nums', over ? 'fill-destructive' : 'fill-foreground')}>{speed == null ? '—' : v}</text>
      <text x={CX} y={CY + 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">km/jam</text>
    </svg>
  );
}
