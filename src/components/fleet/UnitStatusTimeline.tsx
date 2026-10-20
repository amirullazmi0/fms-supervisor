'use client';
// Riwayat status unit 24 jam terakhir (working / standby / breakdown + delay code), dari MDT
// operator atau input supervisor. Bar = proporsi waktu tiap status.
import { useNow } from '@/lib/useNow';
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import SetUnitStatus from '@/components/fleet/SetUnitStatus';
import { fmtDuration, fmtHm } from '@/lib/format';
import { DELAY_CATEGORY, DELAY_TONE, SOURCE } from '@/lib/labels';
import { P, useCan } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, Tip } from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { DelayCategory, UnitStatusLog } from '@/types/fleet';

const BAR: Record<DelayCategory, string> = {
    working: 'var(--success)',
    standby_planned: 'var(--info)',
    standby_unplanned: 'var(--warning)',
    breakdown: 'var(--destructive)',
};

export default function UnitStatusTimeline({ imei }: { imei: string }) {
    const can = useCan();
    const [editing, setEditing] = useState(false);
    // `to` dikosongkan (server = sekarang) agar status baru tetap masuk saat di-refetch lewat stream.
    const [range] = useState(() => ({ from: Date.now() - 24 * 3600e3 }));
    const logs = useQueryApiRequest<GlobalApiResponse<UnitStatusLog[]>>({
        key: 'unit-status',
        queries: { imei, from: range.from },
        config: { errorNotification: false },
    });
    const list = logs.data?.data ?? [];
    const now = useNow(60000);
    const span = (l: UnitStatusLog) =>
        Math.min(l.endAt ?? now, now) - Math.max(l.startAt, range.from);
    const total = list.reduce((s, l) => s + Math.max(0, span(l)), 0) || 1;
    const byCat = (Object.keys(BAR) as DelayCategory[]).map((c) => ({
        c,
        ms: list.filter((l) => l.category === c).reduce((s, l) => s + Math.max(0, span(l)), 0),
    }));

    return (
        <Card className="gap-3">
            <CardHeader className="flex-wrap">
                <div>
                    <CardTitle>Status unit (24 jam)</CardTitle>
                    <CardDescription>
                        Dari MDT operator / input supervisor · dasar PA &amp; UA
                    </CardDescription>
                </div>
                {can(P.unitStatusWrite) && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        <Pencil /> Input status
                    </Button>
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {list.length === 0 ? (
                    <Empty>
                        Belum ada status. Pasangkan tablet MDT di unit ini, atau input manual.
                    </Empty>
                ) : (
                    <>
                        <div className="flex h-4 overflow-hidden rounded-md bg-muted">
                            {[...list].reverse().map((l) => (
                                <Tip
                                    key={l.id}
                                    label={`${l.delayName ?? l.status} · ${fmtHm(l.startAt)}–${l.endAt ? fmtHm(l.endAt) : 'sekarang'} · ${fmtDuration(span(l))}`}
                                >
                                    <div
                                        style={{
                                            width: `${(Math.max(0, span(l)) / total) * 100}%`,
                                            background: l.category
                                                ? BAR[l.category]
                                                : 'var(--muted-foreground)',
                                        }}
                                    />
                                </Tip>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {byCat
                                .filter((x) => x.ms > 0)
                                .map((x) => (
                                    <span key={x.c} className="flex items-center gap-1.5">
                                        <i
                                            className="size-2.5 rounded-sm"
                                            style={{ background: BAR[x.c] }}
                                        />{' '}
                                        {DELAY_CATEGORY[x.c]} {fmtDuration(x.ms)}
                                    </span>
                                ))}
                        </div>
                        <ul className="m-0 flex max-h-72 list-none flex-col gap-1.5 overflow-y-auto p-0 text-[13px]">
                            {list.map((l) => (
                                <li key={l.id} className="flex items-center gap-2">
                                    <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                                        {fmtHm(l.startAt)}–{l.endAt ? fmtHm(l.endAt) : 'skrg'}
                                    </span>
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                                            l.category ? DELAY_TONE[l.category] : 'bg-muted',
                                        )}
                                    >
                                        {l.delayName ?? l.status}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                        {SOURCE[l.source] ?? l.source}
                                        {l.driverName ? ` · ${l.driverName}` : ''}
                                        {l.note ? ` · ${l.note}` : ''}
                                        {l.receivedAt - l.startAt > 5 * 60e3
                                            ? ` · masuk ${fmtHm(l.receivedAt)} (dari blank spot)`
                                            : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </CardContent>
            {editing && (
                <SetUnitStatus imei={imei} open onOpenChange={(o) => !o && setEditing(false)} />
            )}
        </Card>
    );
}
