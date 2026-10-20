'use client';
// Panel dispatcher (P2-5 … P2-7): per fleet (rute + excavator) match factor live, DT antre di front,
// hanging time excavator, DT tidak aktif + alasannya, dan saran memindahkan DT antar fleet.
import { useState } from 'react';
import { ArrowRight, Construction, Shuffle } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { PageHeader, EmptyState } from '@/components/fleet/Page';
import { useToast } from '@/components/fleet/Toasts';
import { useData } from '@/provider/StreamProvider';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ConfirmDialog,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Empty } from '@/components/ui/misc';
import { SimpleSelect } from '@/components/ui/select';
import { errText } from '@/lib/api-error';
import { fmtDuration, fmtNum, truckLabel } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { DispatchBoard, Fleet, FleetMove, FleetTruck, MatchClass } from '@/types/fleet';

const MATCH: Record<
    Exclude<MatchClass, ''>,
    { label: string; hint: string; variant: BadgeVariant }
> = {
    under: {
        label: 'Undermatch',
        hint: 'DT kurang, excavator menunggu (hanging).',
        variant: 'warning',
    },
    match: { label: 'Match', hint: 'Jumlah DT seimbang dengan excavator.', variant: 'success' },
    over: { label: 'Overmatch', hint: 'DT berlebih, DT antre di front.', variant: 'destructive' },
};

const mfText = (v: number | null) => (v == null ? '—' : fmtNum(v, 2));

export default function DispatchView() {
    const board = useQueryApiRequest<GlobalApiResponse<DispatchBoard>>({
        key: 'dispatch-fleets',
        options: { refetchInterval: 30000 },
    });
    const can = useCan();
    const data = board.data?.data;
    const [loaderFor, setLoaderFor] = useState<Fleet | null>(null);
    const [move, setMove] = useState<{
        imei: string;
        label: string;
        from: string;
        to: string;
    } | null>(null);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 md:p-5">
            <PageHeader
                title="Panel dispatcher"
                description="Match factor (MF) = (DT aktif × waktu muat) ÷ (excavator × cycle time DT). Waktu muat & cycle time dari ritase 3 jam terakhir (bila belum ada: 7 hari, lalu perkiraan). Diperbarui tiap 30 detik."
            />
            {board.isLoading ? (
                <Empty>Memuat…</Empty>
            ) : !data || data.fleets.length === 0 ? (
                <EmptyState icon={Construction} title="Belum ada fleet">
                    Fleet = rute (front loading → dumping) + excavator. Buat rute di menu Front,
                    dumping & rute.
                </EmptyState>
            ) : (
                <>
                    {data.moves.length > 0 && (
                        <section className="flex flex-col gap-2 rounded-xl border border-info bg-info-soft p-4">
                            <h2 className="m-0 flex items-center gap-2 text-sm font-semibold">
                                <Shuffle className="size-4" /> Saran redistribusi
                            </h2>
                            {data.moves.map((m) => (
                                <MoveRow
                                    key={m.imei}
                                    m={m}
                                    canMove={can(P.dispatchManage)}
                                    onMove={() =>
                                        setMove({
                                            imei: m.imei,
                                            label: m.label,
                                            from: m.fromRouteName,
                                            to: m.toRouteId,
                                        })
                                    }
                                />
                            ))}
                        </section>
                    )}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {data.fleets.map((f) => (
                            <FleetCard
                                key={f.routeId}
                                f={f}
                                fleets={data.fleets}
                                canManage={can(P.dispatchManage)}
                                onLoader={() => setLoaderFor(f)}
                                onMove={(t, to) =>
                                    setMove({ imei: t.imei, label: t.label, from: f.routeName, to })
                                }
                            />
                        ))}
                    </div>
                </>
            )}
            {loaderFor && <LoaderDialog f={loaderFor} onClose={() => setLoaderFor(null)} />}
            <MoveConfirm move={move} fleets={data?.fleets ?? []} onClose={() => setMove(null)} />
        </div>
    );
}

function MoveRow({ m, canMove, onMove }: { m: FleetMove; canMove: boolean; onMove: () => void }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-card px-3 py-2 text-[13px]">
            <b>{m.label}</b>
            <span className="flex items-center gap-1.5">
                {m.fromRouteName} <ArrowRight className="size-3.5" /> {m.toRouteName}
            </span>
            <span className="text-xs text-muted-foreground">
                MF sesudah: {m.fromRouteName} {mfText(m.fromMfAfter)} · {m.toRouteName}{' '}
                {mfText(m.toMfAfter)}
            </span>
            {canMove && (
                <Button size="sm" className="ml-auto" onClick={onMove}>
                    Pindahkan
                </Button>
            )}
        </div>
    );
}

function FleetCard({
    f,
    fleets,
    canManage,
    onLoader,
    onMove,
}: {
    f: Fleet;
    fleets: Fleet[];
    canManage: boolean;
    onLoader: () => void;
    onMove: (t: FleetTruck, toRouteId: string) => void;
}) {
    const m = f.match ? MATCH[f.match] : null;
    const hangPct = f.hangingMs != null ? Math.round((f.hangingMs / f.hangingWindow) * 100) : null;
    const others = fleets.filter((x) => x.routeId !== f.routeId);
    return (
        <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="m-0 truncate text-base font-semibold">{f.routeName}</h2>
                    <p className="m-0 truncate text-xs text-muted-foreground">
                        {f.loadingName} → {f.unloadingName}
                    </p>
                </div>
                <div className="text-right">
                    <p
                        className={cn(
                            'm-0 text-3xl font-bold tabular-nums leading-none',
                            f.match === 'under' && 'text-warning',
                            f.match === 'match' && 'text-success',
                            f.match === 'over' && 'text-destructive',
                        )}
                    >
                        {mfText(f.matchFactor)}
                    </p>
                    <p className="m-0 text-xs text-muted-foreground">Match factor</p>
                </div>
            </header>
            {m && (
                <p className="m-0 flex flex-wrap items-center gap-2 text-[13px]">
                    <Badge variant={m.variant}>{m.label}</Badge>
                    <span className="text-muted-foreground">{m.hint}</span>
                </p>
            )}
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
                <Item label="DT aktif" value={`${f.active} / ${f.trucks.length}`} />
                <Item
                    label="DT ideal (MF 1)"
                    value={f.idealTrucks != null ? fmtNum(f.idealTrucks, 1) : '—'}
                />
                <Item label="Antre di front" value={`${f.queue} DT`} danger={f.queue > 1} />
                <Item label="Cycle time DT" value={fmtDuration(f.cycleMs)} />
                <Item label="Waktu muat / DT" value={fmtDuration(f.loadTimeMs)} />
                <Item label="Basis data" value={f.basisWindow} />
            </dl>

            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-[13px]">
                <Construction className="size-4 shrink-0 text-muted-foreground" />
                {f.loader ? (
                    <span className="min-w-0 flex-1 truncate">
                        <b>{f.loader.label}</b>
                        {f.loader.productivityTph != null &&
                            ` · ${fmtNum(f.loader.productivityTph)} t/jam`}
                        {hangPct != null && (
                            <span className={cn(hangPct > 30 && 'text-warning')}>
                                {' '}
                                · hanging {fmtDuration(f.hangingMs ?? 0)} ({hangPct}% dari 60 mnt)
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="flex-1 text-muted-foreground">
                        Belum ada excavator. MF dihitung dengan 1 excavator.
                    </span>
                )}
                {canManage && (
                    <Button size="sm" variant="outline" onClick={onLoader}>
                        {f.loader ? 'Ganti' : 'Pasang excavator'}
                    </Button>
                )}
            </div>

            {f.trucks.length === 0 ? (
                <Empty>Belum ada DT bertugas di fleet ini.</Empty>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {f.trucks.map((t) => (
                        <li
                            key={t.imei}
                            className={cn(
                                'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-[13px]',
                                t.inactive && 'border-warning bg-warning-soft',
                            )}
                        >
                            <b className="w-20 shrink-0 truncate">{t.label}</b>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                {t.driverName}
                                {t.atFront && ' · di front'}
                                {t.inactive ? (
                                    <span className="text-warning"> · {t.inactive}</span>
                                ) : (
                                    t.status && ` · ${t.status}`
                                )}
                            </span>
                            {canManage && others.length > 0 && (
                                <SimpleSelect
                                    value=""
                                    size="sm"
                                    className="w-36"
                                    placeholder="Pindah ke…"
                                    aria-label={`Pindahkan ${t.label}`}
                                    onChange={(to) => onMove(t, to)}
                                    options={others.map((x) => ({
                                        value: x.routeId,
                                        label: x.routeName,
                                    }))}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function Item({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
    return (
        <div className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className={cn('m-0 font-semibold tabular-nums', danger && 'text-destructive')}>
                {value}
            </dd>
        </div>
    );
}

function LoaderDialog({ f, onClose }: { f: Fleet; onClose: () => void }) {
    const { devices } = useData();
    const toast = useToast();
    const [imei, setImei] = useState(f.loader?.imei ?? '');
    const [tph, setTph] = useState(
        f.loader?.productivityTph ? String(f.loader.productivityTph) : '',
    );
    const save = useMutationApiRequest<
        GlobalApiResponse<null>,
        { imei: string; productivityTph?: number }
    >({ key: 'dispatch-loader', params: { id: f.routeId }, config: SILENT });
    // Excavator dulu, lalu unit lain (alat muat bisa saja belum diberi jenis EX).
    const units = Object.values(devices).sort(
        (a, b) =>
            Number(b.unitType === 'EX') - Number(a.unitType === 'EX') ||
            truckLabel(a).localeCompare(truckLabel(b)),
    );
    const value = Number(tph.replace(',', '.'));
    const tphError = tph && !(value > 0 && value <= 10000) ? 'Isi 1–10.000 t/jam' : undefined;

    const submit = async (clear: boolean) => {
        try {
            await save.mutateAsync(
                clear ? { imei: '' } : { imei, ...(tph ? { productivityTph: value } : {}) },
            );
            toast({ title: clear ? 'Excavator dilepas dari fleet' : 'Excavator fleet disimpan' });
            onClose();
        } catch (err) {
            toast({ title: 'Gagal menyimpan excavator', body: errText(err), level: 'crit' });
        }
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Excavator fleet {f.routeName}</DialogTitle>
                    <DialogDescription>
                        Satu excavator hanya di satu fleet; memasangnya di sini melepasnya dari
                        fleet lain. Riwayatnya disimpan.
                    </DialogDescription>
                </DialogHeader>
                <Field label="Unit alat muat">
                    <SimpleSelect
                        value={imei}
                        onChange={setImei}
                        placeholder="Pilih excavator"
                        aria-label="Excavator"
                        options={units.map((d) => ({
                            value: d.imei,
                            label: `${truckLabel(d)}${d.unitType === 'EX' ? '' : ` (${d.unitType})`}`,
                        }))}
                    />
                </Field>
                <Field
                    label="Produktivitas (ton / jam)"
                    hint="Opsional. Dipakai sebagai waktu muat bila belum ada data GPS di front."
                    error={tphError}
                >
                    <Input
                        value={tph}
                        onChange={(e) => setTph(e.target.value)}
                        inputMode="decimal"
                        placeholder="400"
                        autoComplete="off"
                    />
                </Field>
                <DialogFooter className="sm:justify-between">
                    {f.loader ? (
                        <Button variant="ghost" onClick={() => void submit(true)}>
                            Lepas excavator
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button
                        disabled={!imei || !!tphError || save.isPending}
                        onClick={() => void submit(false)}
                    >
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MoveConfirm({
    move,
    fleets,
    onClose,
}: {
    move: { imei: string; label: string; from: string; to: string } | null;
    fleets: Fleet[];
    onClose: () => void;
}) {
    const toast = useToast();
    const run = useMutationApiRequest<
        GlobalApiResponse<unknown>,
        { imei: string; toRouteId: string }
    >({ key: 'dispatch-move', config: SILENT });
    const to = fleets.find((f) => f.routeId === move?.to);
    return (
        <ConfirmDialog
            open={move != null}
            onOpenChange={(o) => !o && onClose()}
            title={`Pindahkan ${move?.label ?? ''} ke fleet ${to?.routeName ?? ''}?`}
            description={`Penugasan di fleet ${move?.from ?? ''} diselesaikan sekarang (ritase yang sudah ada tetap tercatat), lalu unit & operatornya ditugaskan di shift berjalan fleet ${to?.routeName ?? ''}. Beri tahu operator lewat radio.`}
            confirmLabel="Ya, pindahkan"
            onConfirm={() => {
                if (!move) return;
                void run
                    .mutateAsync({ imei: move.imei, toRouteId: move.to })
                    .then(() =>
                        toast({ title: `${move.label} dipindah ke ${to?.routeName ?? ''}` }),
                    )
                    .catch((err) =>
                        toast({
                            title: 'Gagal memindahkan unit',
                            body: errText(err),
                            level: 'crit',
                        }),
                    )
                    .finally(onClose);
            }}
        />
    );
}
