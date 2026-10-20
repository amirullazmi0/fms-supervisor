'use client';
// Beranda dispatcher: satu layar untuk memantau. Produksi hari ini vs target, shift berjalan, papan
// unit (working / antre / standby / BD / tanpa data) dengan aktivitas & lokasi, dan alert yang perlu
// ditindak. Semua dari data yang sudah ada (useData + laporan per jam + status MDT).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    CalendarPlus,
    ChevronRight,
    Clock3,
    Gauge,
    ListOrdered,
    MapPin,
    Pencil,
    Radio,
    Truck,
    Wrench,
} from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { EmptyState, PageHeader, Panel, Skeleton } from '@/components/fleet/Page';
import { HourBadge } from '@/components/fleet/Production';
import SetUnitStatus from '@/components/fleet/SetUnitStatus';
import { BOARD_COLUMNS, useUnitBoard } from '@/lib/board';
import type { BoardColumn, BoardUnit } from '@/lib/board';
import { ACTIVITY_TONE } from '@/lib/activity';
import { fmtDate, fmtDuration, fmtHm, fmtNum, dateKey } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useData } from '@/provider/StreamProvider';
import { useNow } from '@/lib/useNow';
import { Button } from '@/components/ui/button';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { HourlyReport, Shift } from '@/types/fleet';

type R<T> = GlobalApiResponse<T>;

export default function HomeView() {
    const now = useNow(30000);
    const can = useCan();
    const { shifts, events, devices, routes } = useData();
    const { setStats } = useLayout();
    const board = useUnitBoard();
    const [column, setColumn] = useState<BoardColumn | 'all'>('all');
    const [editing, setEditing] = useState<string | undefined | null>(null);

    const today = dateKey();
    const queries = useMemo(
        // to kosong = sampai sekarang (server), jadi kunci query tidak berubah setiap detik.
        () => ({ from: new Date(`${today}T00:00:00`).getTime() }),
        [today],
    );
    const hourly = useQueryApiRequest<R<HourlyReport>>({
        key: 'reports-hourly',
        queries,
        config: { errorNotification: false },
        options: { enabled: can(P.reportRead), refetchInterval: 60000 },
    });
    const rep = hourly.data?.data;
    const total = rep?.total;
    const thisHour = rep?.rows.at(-1);

    const active = shifts.filter((s) => s.status === 'active');
    const planned = shifts.filter((s) => s.status === 'planned' && s.date === today);
    const count = (c: BoardColumn) => board.filter((u) => u.column === c).length;
    const shown = column === 'all' ? board : board.filter((u) => u.column === column);

    // Yang perlu ditindak: antrean, event kritis, shift lewat jam, unit bertugas tanpa data.
    const alerts = useMemo(() => {
        const since = now - 3 * 3600e3;
        const list: {
            key: string;
            tone: 'warn' | 'crit';
            icon: typeof AlertTriangle;
            title: string;
            body: string;
            to?: string;
            time: number;
        }[] = [];
        for (const e of events) {
            if (e.time < since || !(e.kind === 'queue' || e.level === 'crit')) continue;
            const d = devices[e.imei];
            list.push({
                key: `e${e.time}${e.imei}`,
                tone: e.level === 'crit' ? 'crit' : 'warn',
                icon: e.kind === 'queue' ? ListOrdered : AlertTriangle,
                title: e.text,
                body: d?.plate || d?.name || e.imei,
                to: `/track?unit=${e.imei}`,
                time: e.time,
            });
        }
        for (const s of active.filter((x) => x.overdue)) {
            list.push({
                key: `o${s.id}`,
                tone: 'warn',
                icon: Clock3,
                title: `Shift ${s.name} lewat jam selesai`,
                body: 'Tutup atau perpanjang',
                to: `/shifts?shift=${s.id}`,
                time: s.plannedEnd,
            });
        }
        for (const u of board.filter((x) => x.column === 'nodata')) {
            list.push({
                key: `n${u.imei}`,
                tone: 'warn',
                icon: Radio,
                title: `${u.unit} belum kirim data`,
                body: u.activity.detail ?? 'Kemungkinan di blank spot',
                to: `/track?unit=${u.imei}`,
                time: 0,
            });
        }
        for (const u of board.filter((x) => x.column === 'breakdown')) {
            list.push({
                key: `b${u.imei}`,
                tone: 'crit',
                icon: Wrench,
                title: `${u.unit} breakdown`,
                body: `${u.mdt?.delayName ?? 'BD'} · ${u.driverName}`,
                to: `/track?unit=${u.imei}`,
                time: u.since ?? 0,
            });
        }
        return list.sort((a, b) => b.time - a.time).slice(0, 12);
    }, [events, devices, active, board, now]);

    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Bertugas" value={board.length} />
                <HeaderStat
                    label="Antre"
                    value={count('queue')}
                    tone={count('queue') > 0 ? 'danger' : undefined}
                />
                <HeaderStat
                    label="BD"
                    value={count('breakdown')}
                    tone={count('breakdown') > 0 ? 'danger' : undefined}
                />
            </>,
        );
        return () => setStats(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [board, setStats]);

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-4 p-3 md:p-5">
            <PageHeader
                title="Beranda dispatcher"
                description={`${fmtDate(today)} · ${fmtHm(now)} · ${active.length} shift berjalan${planned.length ? `, ${planned.length} terjadwal` : ''}`}
                actions={
                    <>
                        {can(P.shiftCreate) && (
                            <Button asChild variant="outline">
                                <Link href="/shifts?baru=1">
                                    <CalendarPlus /> Buat shift
                                </Link>
                            </Button>
                        )}
                        {can(P.unitStatusWrite) && (
                            <Button variant="outline" onClick={() => setEditing(undefined)}>
                                <Pencil /> Input status unit
                            </Button>
                        )}
                        {can(P.reportRead) && (
                            <Button asChild>
                                <Link href="/production">
                                    <Gauge /> Produksi
                                </Link>
                            </Button>
                        )}
                    </>
                }
            />

            {/* Angka utama */}
            <section
                className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
                aria-label="Ringkasan"
            >
                <Kpi
                    label="Ritase hari ini"
                    value={total ? fmtNum(total.rit) : '—'}
                    sub={total?.targetRit ? `target ${fmtNum(total.targetRit)}` : undefined}
                    loading={hourly.isLoading}
                />
                <Kpi
                    label="Tonase hari ini"
                    value={total ? `${fmtNum(total.ton)} t` : '—'}
                    sub={
                        total?.achievement != null
                            ? `${fmtNum(total.achievement)}% dari target`
                            : 'target belum diatur'
                    }
                    tone={
                        total?.achievement != null && total.achievement < 100 ? 'warn' : undefined
                    }
                    loading={hourly.isLoading}
                />
                <Kpi
                    label={thisHour ? `Jam ${thisHour.label}` : 'Jam ini'}
                    value={thisHour ? `${thisHour.rit} rit · ${fmtNum(thisHour.ton)} t` : '—'}
                    sub={thisHour ? <HourBadge row={thisHour} /> : undefined}
                    loading={hourly.isLoading}
                />
                <Kpi
                    label="Unit bertugas"
                    value={`${board.length} / ${Object.keys(devices).length}`}
                    sub={`${count('working')} working`}
                />
                <Kpi
                    label="Antre sekarang"
                    value={fmtNum(count('queue'))}
                    tone={count('queue') ? 'warn' : undefined}
                    sub="GPS zona antre + status MDT"
                    onClick={() => setColumn('queue')}
                />
                <Kpi
                    label="Breakdown"
                    value={fmtNum(count('breakdown'))}
                    tone={count('breakdown') ? 'crit' : undefined}
                    sub={`${count('standby')} standby`}
                    onClick={() => setColumn('breakdown')}
                />
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
                {/* Papan unit */}
                <Panel
                    className="lg:col-span-2"
                    title="Papan unit bertugas"
                    hint="Status MDT operator diutamakan, lalu posisi GPS terhadap front / dumping"
                >
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter papan">
                        <Chip active={column === 'all'} onClick={() => setColumn('all')}>
                            Semua {board.length}
                        </Chip>
                        {BOARD_COLUMNS.map((c) => (
                            <Chip
                                key={c.id}
                                active={column === c.id}
                                onClick={() => setColumn(c.id)}
                                tone={c.tone}
                            >
                                {c.label} {count(c.id)}
                            </Chip>
                        ))}
                    </div>
                    {board.length === 0 ? (
                        <EmptyState
                            icon={Truck}
                            title="Belum ada unit bertugas"
                            action={
                                can(P.shiftCreate) ? (
                                    <Button asChild size="sm">
                                        <Link href="/shifts?baru=1">Buat shift</Link>
                                    </Button>
                                ) : undefined
                            }
                        >
                            Unit muncul di sini setelah ditugaskan di shift yang berjalan.
                        </EmptyState>
                    ) : shown.length === 0 ? (
                        <EmptyState title="Tidak ada unit di kolom ini" />
                    ) : (
                        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                            {shown.map((u) => (
                                <UnitCard
                                    key={u.imei}
                                    u={u}
                                    now={now}
                                    onEdit={
                                        can(P.unitStatusWrite)
                                            ? () => setEditing(u.imei)
                                            : undefined
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </Panel>

                <div className="flex flex-col gap-4">
                    {/* Shift berjalan */}
                    <Panel
                        title="Shift berjalan"
                        action={
                            <Link
                                href="/shifts"
                                className="text-xs font-medium text-info hover:underline"
                            >
                                Semua shift
                            </Link>
                        }
                    >
                        {active.length === 0 ? (
                            <EmptyState
                                icon={Clock3}
                                title="Tidak ada shift berjalan"
                                className="py-5"
                            >
                                {planned.length
                                    ? `${planned.length} shift terjadwal hari ini.`
                                    : 'Buat shift terlebih dahulu untuk memulai penugasan.'}
                            </EmptyState>
                        ) : (
                            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                {active.map((s) => (
                                    <ShiftRow
                                        key={s.id}
                                        s={s}
                                        now={now}
                                        routeName={routes.find((r) => r.id === s.routeId)?.name}
                                    />
                                ))}
                            </ul>
                        )}
                    </Panel>

                    {/* Alert */}
                    <Panel title="Perlu ditindak" hint="3 jam terakhir">
                        {alerts.length === 0 ? (
                            <EmptyState icon={AlertTriangle} title="Aman" className="py-5">
                                Tidak ada antrean, breakdown, atau unit yang terlambat mengirim
                                data.
                            </EmptyState>
                        ) : (
                            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                {alerts.map((a) => (
                                    <li key={a.key}>
                                        <Link
                                            href={a.to ?? '#'}
                                            className={cn(
                                                'flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted',
                                                a.tone === 'crit'
                                                    ? 'text-destructive'
                                                    : 'text-warning',
                                            )}
                                        >
                                            <a.icon className="size-4 shrink-0" />
                                            <span className="min-w-0 flex-1">
                                                <b className="block truncate text-[13px] text-foreground">
                                                    {a.title}
                                                </b>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {a.body}
                                                    {a.time ? ` · ${fmtHm(a.time)}` : ''}
                                                </span>
                                            </span>
                                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>

            {editing !== null && (
                <SetUnitStatus imei={editing} open onOpenChange={(o) => !o && setEditing(null)} />
            )}
        </div>
    );
}

function Kpi({
    label,
    value,
    sub,
    tone,
    loading,
    onClick,
}: {
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    tone?: 'warn' | 'crit';
    loading?: boolean;
    onClick?: () => void;
}) {
    const className = cn(
        'flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-3 text-left',
        tone === 'warn' && 'border-warning/40 bg-warning-soft',
        tone === 'crit' && 'border-destructive/40 bg-danger-soft',
        onClick && 'transition hover:border-ring',
    );
    const body = (
        <>
            <span className="truncate text-xs text-muted-foreground">{label}</span>
            {loading ? (
                <Skeleton className="h-7 w-20" />
            ) : (
                <b className="truncate text-xl font-semibold tabular-nums">{value}</b>
            )}
            {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
        </>
    );
    return onClick ? (
        <button type="button" onClick={onClick} className={className}>
            {body}
        </button>
    ) : (
        <div className={className}>{body}</div>
    );
}

function Chip({
    active,
    onClick,
    tone,
    children,
}: {
    active: boolean;
    onClick: () => void;
    tone?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'min-h-9 rounded-full border px-3 text-xs font-medium transition',
                active
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : cn('bg-card hover:bg-muted', tone),
            )}
        >
            {children}
        </button>
    );
}

function UnitCard({ u, now, onEdit }: { u: BoardUnit; now: number; onEdit?: () => void }) {
    const col = BOARD_COLUMNS.find((c) => c.id === u.column)!;
    return (
        <li className="flex flex-col gap-1.5 rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2">
                <Link
                    href={`/track?unit=${u.imei}`}
                    className="min-w-0 flex-1 truncate font-semibold hover:underline"
                >
                    {u.unit}
                </Link>
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        col.tone,
                    )}
                >
                    {col.label}
                </span>
                {onEdit && (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                        aria-label={`Ubah status ${u.unit}`}
                    >
                        <Pencil className="size-3.5" />
                    </button>
                )}
            </div>
            <span
                className={cn(
                    'flex min-w-0 items-center gap-1.5 self-start rounded-md px-1.5 py-0.5 text-xs font-semibold',
                    ACTIVITY_TONE[u.activity.kind],
                )}
            >
                <MapPin className="size-3 shrink-0" />{' '}
                <span className="truncate">{u.activity.label}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">
                {u.mdt
                    ? `${u.mdt.delayName ?? u.mdt.status} ${fmtDuration(now - u.mdt.startAt)} · `
                    : ''}
                {u.activity.detail ? `${u.activity.detail} · ` : ''}
                {u.driverName} · {u.routeName}
            </span>
        </li>
    );
}

function ShiftRow({ s, now, routeName }: { s: Shift; now: number; routeName?: string }) {
    const start = s.startedAt ?? s.plannedStart;
    const pct = Math.min(
        100,
        Math.max(0, ((now - start) / Math.max(1, s.plannedEnd - start)) * 100),
    );
    const crew = s.assignments.filter((a) => a.endAt == null).length;
    return (
        <li>
            <Link
                href={`/shifts?shift=${s.id}`}
                className="flex flex-col gap-1.5 rounded-lg border p-2.5 hover:border-ring"
            >
                <span className="flex items-center gap-2 text-sm">
                    <b className="truncate">{s.name}</b>
                    <span className="truncate text-xs text-muted-foreground">
                        {routeName ?? '-'}
                    </span>
                    {s.overdue && (
                        <span className="ml-auto shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                            Lewat jam
                        </span>
                    )}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                        className={cn(
                            'block h-full rounded-full',
                            s.overdue ? 'bg-warning' : 'bg-brand',
                        )}
                        style={{ width: `${pct}%` }}
                    />
                </span>
                <span className="text-xs text-muted-foreground">
                    {fmtHm(start)}–{fmtHm(s.plannedEnd)} · {crew} operator ·{' '}
                    {s.overdue
                        ? `lewat ${fmtDuration(now - s.plannedEnd)}`
                        : `sisa ${fmtDuration(Math.max(0, s.plannedEnd - now))}`}
                </span>
            </Link>
        </li>
    );
}
