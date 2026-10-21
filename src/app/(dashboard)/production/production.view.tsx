'use client';
// Produksi per jam (P1): ritase & tonase per jam vs target, status sementara/final, status unit
// dari MDT, kesegaran data, cycle time per tahap. Alert antrean masuk sebagai notifikasi.
import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { PageHeader } from '@/components/fleet/Page';
import ExportButton from '@/components/fleet/ExportButton';
import {
    FreshnessPanel,
    HourlyPanel,
    StagesPanel,
    UnitStatusPanel,
} from '@/components/fleet/Production';
import SetUnitStatus from '@/components/fleet/SetUnitStatus';
import { useData } from '@/provider/StreamProvider';
import { addDays, dateKey, fmtDate, fmtNum } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { Freshness, HourlyReport, StageReport, UnitStatusLog } from '@/types/fleet';

type R<T> = GlobalApiResponse<T>;
type Day = 'today' | 'yesterday' | 'custom';

export default function ProductionView() {
    const { routes } = useData();
    const { setStats } = useLayout();
    const can = useCan();
    const [day, setDay] = useState<Day>('today');
    const [custom, setCustom] = useState(dateKey());
    const [route, setRoute] = useState('');
    const [editing, setEditing] = useState<{ imei?: string } | null>(null);

    const key = day === 'today' ? dateKey() : day === 'yesterday' ? addDays(dateKey(), -1) : custom;
    const queries = useMemo(() => {
        const from = new Date(`${key}T00:00:00`).getTime();
        // Hari ini: to kosong = sampai sekarang (dihitung server). Hari lalu: sampai akhir hari itu.
        const to = key === dateKey() ? undefined : new Date(`${key}T23:59:59.999`).getTime();
        return { from, ...(to ? { to } : {}), ...(route ? { route } : {}) };
    }, [key, route]);

    const quiet = { errorNotification: false };
    const hourly = useQueryApiRequest<R<HourlyReport>>({
        key: 'reports-hourly',
        queries,
        config: quiet,
        options: { refetchInterval: 60000 },
    });
    const stages = useQueryApiRequest<R<StageReport>>({
        key: 'reports-stages',
        queries,
        config: quiet,
    });
    const fresh = useQueryApiRequest<R<Freshness[]>>({
        key: 'reports-freshness',
        config: quiet,
        options: { refetchInterval: 60000 },
    });
    const current = useQueryApiRequest<R<UnitStatusLog[]>>({
        key: 'unit-status-current',
        config: quiet,
        options: { refetchInterval: 60000 },
    });

    const total = hourly.data?.data?.total;
    useEffect(() => {
        setStats(
            total ? (
                <>
                    <HeaderStat label="Ritase" value={fmtNum(total.rit)} />
                    <HeaderStat label="Tonase" value={`${fmtNum(total.ton)} t`} />
                    {total.achievement != null && (
                        <HeaderStat
                            label="Pencapaian"
                            value={`${fmtNum(total.achievement)}%`}
                            tone={total.achievement < 100 ? 'danger' : undefined}
                        />
                    )}
                </>
            ) : null,
        );
        return () => setStats(null);
    }, [total, setStats]);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 md:p-5">
            <PageHeader
                title="Produksi per jam"
                description="Ritase & tonase per jam (waktu GPS) vs target. Jam berlabel Sementara masih bisa naik saat data dari blank spot masuk."
                actions={
                    <div className="flex flex-wrap gap-2">
                        <ExportButton type="hourly" from={queries.from} to={queries.to} />
                        {can(P.unitStatusWrite) && (
                            <Button variant="outline" onClick={() => setEditing({})}>
                                <Pencil /> Input status unit
                            </Button>
                        )}
                    </div>
                }
            />
            <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                    type="single"
                    value={day}
                    onValueChange={(v) => v && setDay(v as Day)}
                    aria-label="Hari"
                >
                    <ToggleGroupItem value="today">Hari ini</ToggleGroupItem>
                    <ToggleGroupItem value="yesterday">Kemarin</ToggleGroupItem>
                    <ToggleGroupItem value="custom">Tanggal</ToggleGroupItem>
                </ToggleGroup>
                {day === 'custom' && (
                    <Input
                        type="date"
                        value={custom}
                        max={dateKey()}
                        onChange={(e) => setCustom(e.target.value)}
                        className="w-auto"
                    />
                )}
                <Combobox
                    value={route}
                    onChange={setRoute}
                    options={[
                        { value: '', label: 'Semua rute / fleet' },
                        ...routes.map((r) => ({ value: r.id, label: r.name })),
                    ]}
                    placeholder="Semua rute / fleet"
                    className="w-full sm:w-56"
                />
                <span className="text-sm text-muted-foreground">{fmtDate(key)}</span>
            </div>

            <HourlyPanel report={hourly.data?.data ?? null} loading={hourly.isLoading} />

            <div className="grid gap-4 xl:grid-cols-2">
                <UnitStatusPanel
                    list={current.data?.data ?? []}
                    action={
                        can(P.unitStatusWrite)
                            ? (l) => (
                                  <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={`Ubah status ${l.truck}`}
                                      onClick={() => setEditing({ imei: l.imei })}
                                  >
                                      <Pencil />
                                  </Button>
                              )
                            : undefined
                    }
                />
                <FreshnessPanel list={fresh.data?.data ?? []} />
            </div>

            <StagesPanel report={stages.data?.data ?? null} />

            {editing && (
                <SetUnitStatus
                    imei={editing.imei}
                    open
                    onOpenChange={(o) => !o && setEditing(null)}
                />
            )}
        </div>
    );
}
