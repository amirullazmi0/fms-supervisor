'use client';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { displayName, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Device, FleetEvent, Level } from '@/types/fleet';

const META: Record<Level, { icon: typeof Info; label: string; tone: string }> = {
  crit: { icon: CircleAlert, label: 'Kritis', tone: 'bg-danger-soft text-destructive' },
  warn: { icon: TriangleAlert, label: 'Peringatan', tone: 'bg-warning-soft text-warning' },
  info: { icon: Info, label: 'Info', tone: 'bg-info-soft text-info' },
};

interface Props {
  events: FleetEvent[];
  devices: Record<string, Device>;
  withName?: boolean;
  empty: string;
  className?: string;
}

export default function EventList({ events, devices, withName = false, empty, className }: Props) {
  return (
    <ul className={cn('m-0 flex list-none flex-col gap-1 p-0', className)}>
      {events.length === 0 && <li className="py-1 text-[13px] text-muted-foreground">{empty}</li>}
      {events.map((e, i) => {
        const m = META[e.level];
        const d = devices[e.imei];
        return (
          <li key={`${e.time}-${i}`} className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-muted/60">
            <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md', m.tone)} title={m.label} aria-label={m.label}>
              <m.icon className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] leading-snug">{e.text}</span>
              <span className="text-[11.5px] text-muted-foreground">{fmtDateTime(e.time)}{withName && d ? ` · ${displayName(d)}` : ''}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
