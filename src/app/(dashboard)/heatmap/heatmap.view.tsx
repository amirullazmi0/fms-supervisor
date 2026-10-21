'use client';
// Heat map jalan (P3-2): kecepatan unit per segmen jalan selama ritase (bermuatan / kosongan, titik
// di dalam radius front & dumping dibuang) + titik guncangan akselerometer (indikasi jalan rusak).
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { PageHeader } from '@/components/fleet/Page';
import { HEAT_GRADIENT, SHOCK } from '@/components/fleet/HeatMap';
import type { HeatMode } from '@/components/fleet/HeatMap';
import { useData } from '@/provider/StreamProvider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Empty, Note } from '@/components/ui/misc';
import { SimpleSelect } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { addDays, dateKey, fmtNum } from '@/lib/format';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { HeatmapReport, ShockPoint } from '@/types/fleet';

const HeatMap = dynamic(() => import('@/components/fleet/HeatMap'), { ssr: false });

type Range = 'today' | '7d' | '30d';
type Load = 'all' | 'loaded' | 'empty';

export default function HeatmapView() {
    const { routes, sites } = useData();
    const [range, setRange] = useState<Range>('7d');
    const [load, setLoad] = useState<Load>('all');
    const [route, setRoute] = useState('');
    const [showShocks, setShowShocks] = useState(false);
    const [mode, setMode] = useState<HeatMode>('slow');

    const queries = useMemo(() => {
        const today = dateKey();
        const from = range === 'today' ? today : addDays(today, range === '7d' ? -6 : -29);
        return {
            from: new Date(`${from}T00:00:00`).getTime(),
            ...(load !== 'all' ? { load } : {}),
            ...(route ? { route } : {}),
        };
    }, [range, load, route]);

    const report = useQueryApiRequest<GlobalApiResponse<HeatmapReport>>({
        key: 'reports-heatmap',
        queries,
        options: { staleTime: 60000 },
    });
    const rep = report.data?.data;
    const shocks = useMemo(() => (showShocks ? (rep?.shocks ?? []) : []), [rep, showShocks]);
    const shownSites = useMemo(() => {
        const r = routes.find((x) => x.id === route);
        return r ? sites.filter((s) => s.id === r.loadingId || s.id === r.unloadingId) : sites;
    }, [routes, sites, route]);
    // Titik panas = sel lambat (< 10 km/jam) yang sering dilalui.
    const slow = (rep?.cells ?? []).filter((c) => c.avgSpeed < 10 && c.points >= 5).length;
    const byKind = (rep?.shocks ?? []).reduce<Partial<Record<ShockPoint['kind'], number>>>(
        (m, s) => ({ ...m, [s.kind]: (m[s.kind] ?? 0) + 1 }),
        {},
    );

    return (
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-3 p-3 md:p-5">
            <PageHeader
                title="Heat map jalan"
                description="Kecepatan unit per segmen jalan selama ritase, di luar radius front loading & dumping. Mode titik panas: merah = unit lambat dan sering lewat (bottleneck). Arahkan kursor ke jalan untuk melihat angkanya."
            />
            <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                    type="single"
                    value={mode}
                    onValueChange={(v) => v && setMode(v as HeatMode)}
                    aria-label="Mode heat map"
                >
                    <ToggleGroupItem value="slow">Titik panas (lambat)</ToggleGroupItem>
                    <ToggleGroupItem value="traffic">Kepadatan lalu lintas</ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup
                    type="single"
                    value={range}
                    onValueChange={(v) => v && setRange(v as Range)}
                    aria-label="Periode"
                >
                    <ToggleGroupItem value="today">Hari ini</ToggleGroupItem>
                    <ToggleGroupItem value="7d">7 hari</ToggleGroupItem>
                    <ToggleGroupItem value="30d">30 hari</ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup
                    type="single"
                    value={load}
                    onValueChange={(v) => v && setLoad(v as Load)}
                    aria-label="Muatan"
                >
                    <ToggleGroupItem value="all">Semua</ToggleGroupItem>
                    <ToggleGroupItem value="loaded">Bermuatan (hauling)</ToggleGroupItem>
                    <ToggleGroupItem value="empty">Kosongan (return)</ToggleGroupItem>
                </ToggleGroup>
                <SimpleSelect
                    value={route}
                    onChange={(v) => setRoute(v === 'all' ? '' : v)}
                    placeholder="Semua rute"
                    aria-label="Rute"
                    className="w-52"
                    options={[
                        { value: 'all', label: 'Semua rute' },
                        ...routes.map((r) => ({ value: r.id, label: r.name })),
                    ]}
                />
                <Label className="gap-2 font-normal">
                    <Checkbox
                        checked={showShocks}
                        onCheckedChange={(v) => setShowShocks(Boolean(v))}
                    />
                    Titik guncangan
                </Label>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                    {mode === 'slow' ? 'Lancar' : 'Sepi'}
                    <i
                        className="h-2.5 w-40 rounded-full"
                        style={{
                            background: `linear-gradient(to right, ${HEAT_GRADIENT.map(([at, c]) => `${c} ${at * 100}%`).join(', ')})`,
                        }}
                    />
                    {mode === 'slow' ? 'Lambat & sering dilalui' : 'Padat'}
                </span>
                {showShocks &&
                    (Object.keys(SHOCK) as ShockPoint['kind'][]).map((k) => (
                        <span key={k} className="flex items-center gap-1">
                            <i
                                className="size-2.5 rounded-full"
                                style={{ background: SHOCK[k].color }}
                            />
                            {SHOCK[k].label} {byKind[k] ? `(${byKind[k]})` : ''}
                        </span>
                    ))}
            </div>

            {rep && (
                <p className="m-0 text-[13px]">
                    {fmtNum(rep.cells.length)} segmen jalan ·{' '}
                    <b className={slow ? 'text-destructive' : undefined}>{slow} titik panas</b>{' '}
                    (rata-rata &lt; 10 km/jam, ≥ 5 titik GPS) · {fmtNum(rep.shocks.length)}{' '}
                    guncangan
                </p>
            )}
            {rep?.truncated && (
                <Note tone="info">
                    Data terlalu banyak; hanya segmen yang paling sering dilalui yang ditampilkan.
                    Persempit periode atau pilih rute.
                </Note>
            )}
            <div className="min-h-[420px] flex-1">
                {report.isLoading ? (
                    <Empty>Memuat heat map…</Empty>
                ) : rep && rep.cells.length === 0 ? (
                    <Empty>Belum ada ritase selesai pada periode ini.</Empty>
                ) : (
                    <HeatMap
                        cells={rep?.cells ?? []}
                        mode={mode}
                        shocks={shocks}
                        sites={shownSites}
                    />
                )}
            </div>
        </div>
    );
}
