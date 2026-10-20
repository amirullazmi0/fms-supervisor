'use client';
// Armada: daftar semua truk, pilih satu buat lihat kondisinya (sama kayak Live: CAN, riwayat,
// event, kirim perintah, IO) + data mentah (semua paket IO / CAN yang disimpan) per tanggal.
// Truk yang dipilih & tanggalnya disimpan di URL (?imei=&date=). Buka menu = truk paling atas.
import { useEffect, useMemo, useState } from 'react';
import { useQueryState } from 'nuqs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import RawRecords from '@/components/fleet/RawRecords';
import DeviceDetail, { useDeviceHistory } from '@/components/fleet/DeviceDetail';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useData } from '@/provider/StreamProvider';
import { useDone, useDuty, workState } from '@/lib/duty';
import { Badge } from '@/components/ui/badge';
import {
    addDays,
    ago,
    dateKey,
    fmtDate,
    fmtNum,
    lastHeard,
    statusOf,
    truckLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, SearchInput } from '@/components/ui/input';
import { Empty, Note, StatusBadge } from '@/components/ui/misc';

export default function FleetView() {
    const { devices, io, groups, events, cmdLog } = useData();
    const duty = useDuty();
    const doneMap = useDone();
    const { setStats } = useLayout();
    const [search, setSearch] = useState('');
    const [imei, setImei] = useQueryState('imei');
    const [dateParam, setDate] = useQueryState('date');
    const date = dateParam ?? dateKey();

    const list = useMemo(
        () =>
            Object.values(devices)
                .sort((a, b) => truckLabel(a).localeCompare(truckLabel(b)))
                .filter((d) => {
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    const job = duty.get(d.imei);
                    return [
                        d.imei,
                        d.plate,
                        d.name,
                        d.vehicle,
                        job?.driverName,
                        job?.routeName,
                    ].some((x) => x?.toLowerCase().includes(q));
                }),
        [devices, search, duty],
    );
    const all = Object.values(devices);
    const online = all.filter((d) => d.online).length;
    // Belum milih (baru buka menu): pilih truk paling atas di daftar. Di HP tetap mulai dari daftar.
    useEffect(() => {
        if (imei || !list.length || window.matchMedia('(max-width: 767px)').matches) return;
        void setImei(list[0].imei, { history: 'replace' });
    }, [imei, list, setImei]);
    const d = imei ? devices[imei] : undefined;
    const job = d ? duty.get(d.imei) : undefined;
    const [rangeMin, setRangeMin] = useState('60');
    const history = useDeviceHistory(d?.imei ?? null, rangeMin);

    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Unit" value={all.length} />
                <HeaderStat label="Online" value={online} />
            </>,
        );
    }, [setStats, all.length, online]);
    useEffect(() => () => setStats(null), [setStats]);

    const today = dateKey();
    return (
        <div className="grid h-full min-h-0 md:grid-cols-[320px_1fr]">
            <aside className={cn('flex min-h-0 flex-col gap-3 border-r p-4', d && 'max-md:hidden')}>
                <SearchInput
                    placeholder="Cari plat, IMEI, operator…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Cari unit"
                />
                <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-0">
                    {list.map((x) => {
                        const j = duty.get(x.imei);
                        return (
                            <li key={x.imei}>
                                <button
                                    type="button"
                                    onClick={() => void setImei(x.imei)}
                                    className={cn(
                                        'flex w-full flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:border-ring',
                                        imei === x.imei && 'border-brand ring-3 ring-brand/25',
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <b className="truncate">{truckLabel(x)}</b>
                                        <StatusBadge status={statusOf(x)} />
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {j
                                            ? `${j.driverName} · ${j.routeName}${j.phase === 'finishing' ? ' · menyelesaikan ritase' : ''}`
                                            : doneMap.get(x.imei)
                                              ? `Selesai · ${doneMap.get(x.imei)!.shiftName}`
                                              : 'Nganggur'}{' '}
                                        · {ago(lastHeard(x))}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                    {list.length === 0 && <Empty>Nggak ada unit yang cocok.</Empty>}
                </ul>
            </aside>

            <section
                className={cn(
                    'flex min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6',
                    !d && 'max-md:hidden',
                )}
            >
                {!d ? (
                    <Empty className="m-auto">Pilih unit di kiri buat lihat data mentahnya.</Empty>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="md:hidden"
                                    onClick={() => void setImei(null)}
                                    aria-label="Kembali ke daftar"
                                >
                                    <ChevronLeft />
                                </Button>
                                <h2 className="m-0 text-lg font-semibold">{truckLabel(d)}</h2>
                                <StatusBadge status={statusOf(d)} />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => void setDate(addDays(date, -1))}
                                    aria-label="Hari sebelumnya"
                                >
                                    <ChevronLeft />
                                </Button>
                                <Input
                                    type="date"
                                    className="w-40"
                                    value={date}
                                    max={today}
                                    onChange={(e) =>
                                        e.target.value &&
                                        void setDate(
                                            e.target.value === today ? null : e.target.value,
                                        )
                                    }
                                    aria-label="Tanggal"
                                />
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    disabled={date >= today}
                                    onClick={() =>
                                        void setDate(
                                            addDays(date, 1) >= today ? null : addDays(date, 1),
                                        )
                                    }
                                    aria-label="Hari berikutnya"
                                >
                                    <ChevronRight />
                                </Button>
                            </div>
                        </div>

                        <Note tone="info">
                            <Badge
                                variant={workState(job, doneMap.get(d.imei)).variant}
                                className="mr-1.5"
                            >
                                {workState(job, doneMap.get(d.imei)).label}
                            </Badge>
                            {job ? (
                                <>
                                    <b>{job.driverName}</b> · {job.routeName} ({job.shiftName})
                                    {job.phase === 'finishing'
                                        ? ' · shift distop, nyelesaiin ritase terakhir'
                                        : ''}
                                    .
                                </>
                            ) : doneMap.get(d.imei) ? (
                                <>
                                    Shift <b>{doneMap.get(d.imei)!.shiftName}</b> udah beres.
                                </>
                            ) : (
                                'Nggak ada tugas shift sekarang.'
                            )}{' '}
                            Terdaftar{' '}
                            {d.firstSeen
                                ? new Date(d.firstSeen).toLocaleDateString('id-ID', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                  })
                                : '—'}{' '}
                            · {fmtNum(d.records)} paket tersimpan.
                        </Note>

                        <DeviceDetail
                            key={d.imei}
                            d={d}
                            io={io}
                            groups={groups}
                            history={history}
                            rangeMin={rangeMin}
                            onRange={setRangeMin}
                            events={events
                                .filter((e) => e.imei === d.imei)
                                .slice(-50)
                                .reverse()}
                            devices={devices}
                            cmdLines={cmdLog.filter((l) => l.imei === d.imei)}
                        />

                        <Card className="gap-3 px-4">
                            <h3 className="m-0 text-sm font-semibold">
                                Data mentah · {fmtDate(date)}
                            </h3>
                            <RawRecords imei={d.imei} date={date} />
                        </Card>
                    </>
                )}
            </section>
        </div>
    );
}
