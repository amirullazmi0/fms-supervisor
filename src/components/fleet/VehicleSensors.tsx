'use client';
// Kartu sensor kendaraan di Lacak truk: BBM, mesin, supir, input/suhu bak, pemutus mesin.
// Tiap kartu nampilin "belum terpasang" kalau datanya belum ada, dan keisi otomatis begitu sensornya masuk.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Power, TriangleAlert, Plus } from 'lucide-react';
import LineChart from '@/components/fleet/LineChart';
import { useToast } from '@/components/fleet/Toasts';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import type { GlobalApiResponse } from '@/types/api/responses';
import { useDuty } from '@/lib/duty';
import { fmtDuration, fmtHm, fmtNum, num } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/misc';
import type { DaySummary, Device, IoValue } from '@/types/fleet';

interface Props {
    d: Device;
    day: DaySummary | null;
}

const ibuttonHex = (v: IoValue | undefined) => {
    if (v == null || Number(v) === 0) return null;
    return typeof v === 'number'
        ? v.toString(16).toUpperCase().padStart(16, '0')
        : String(v).toUpperCase();
};

export default function VehicleSensors({ d, day }: Props) {
    const job = useDuty().get(d.imei);
    const io = d.io;
    const n = (id: number) => num(io[id]);

    // BBM
    const liters = n(84) != null && n(84)! > 0 ? n(84)! / 10 : null;
    const pct = n(89);
    const unit = day?.fuelUnit ?? (liters != null ? 'L' : pct != null ? '%' : null);
    const fuelPoints = (day?.points ?? [])
        .filter((p) => p.fuel != null)
        .map((p) => ({ t: p.t, y: p.fuel! }));
    const hasFuel = liters != null || pct != null;

    // Mesin
    const rpm = n(85);
    const temp = n(115);
    const hasEngineCan = rpm != null || temp != null;

    const ibutton = ibuttonHex(io[78]);
    const cargoTemp = n(72);

    return (
        <section className="flex flex-col gap-3" aria-label="Sensor kendaraan">
            <SensorCard
                title="BBM"
                source="CAN / sensor tangki"
                empty={!hasFuel}
                emptyText="Belum ada data BBM. Muncul setelah CAN terpasang dan Program Number di-set, atau sensor tangki disambung ke AIN1."
            >
                <div className="flex flex-col gap-2">
                    <span className="text-3xl font-bold tabular-nums tracking-tight">
                        {liters != null ? fmtNum(liters, 1) : pct}
                        <small className="ml-1 text-sm font-normal text-muted-foreground">
                            {liters != null ? 'L' : '%'}
                        </small>
                    </span>
                    {pct != null && (
                        <span
                            className="h-2 overflow-hidden rounded-full bg-muted"
                            role="meter"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pct}
                            aria-label="Level BBM"
                        >
                            <i
                                className={cn(
                                    'block h-full rounded-full',
                                    pct < 15 ? 'bg-destructive' : 'bg-brand',
                                )}
                                style={{ width: `${Math.min(100, pct)}%` }}
                            />
                        </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                        {pct != null && liters != null ? `${pct}% tangki · ` : ''}
                        {day?.fuelUsed != null
                            ? `terpakai hari ini ${fmtNum(day.fuelUsed, 1)} ${unit}`
                            : ''}
                    </span>
                </div>
                {fuelPoints.length >= 2 && (
                    <LineChart
                        title="Level BBM hari ini"
                        unit={unit ?? ''}
                        dec={unit === 'L' ? 1 : 0}
                        minZero={false}
                        points={fuelPoints}
                    />
                )}
                {day && day.fuelEvents.length > 0 && (
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {day.fuelEvents.map((e) => (
                            <li
                                key={`${e.type}-${e.time}`}
                                className="flex items-start gap-2 text-[13px]"
                            >
                                <span
                                    className={cn(
                                        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md',
                                        e.type === 'refuel'
                                            ? 'bg-success-soft text-success'
                                            : 'bg-danger-soft text-destructive',
                                    )}
                                >
                                    {e.type === 'refuel' ? (
                                        <Plus className="size-3" />
                                    ) : (
                                        <TriangleAlert className="size-3" />
                                    )}
                                </span>
                                <span>
                                    <b>{e.type === 'refuel' ? 'Isi BBM' : 'Dugaan BBM hilang'}</b>{' '}
                                    {e.type === 'refuel' ? '+' : '−'}
                                    {fmtNum(e.amount, 1)} {unit}
                                    <span className="text-muted-foreground">
                                        {' '}
                                        · {fmtHm(e.time)} · {fmtNum(e.before, 1)} →{' '}
                                        {fmtNum(e.after, 1)} {unit}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </SensorCard>

            <SensorCard title="Mesin" source="ignition + CAN">
                <Grid>
                    <Cell
                        label="Status"
                        value={io[239] == null ? '—' : io[239] ? 'Nyala' : 'Mati'}
                    />
                    <Cell label="Nyala hari ini" value={day ? fmtDuration(day.engineMs) : '—'} />
                    <Cell label="RPM" value={rpm == null ? '—' : fmtNum(rpm)} />
                    <Cell
                        label="Suhu mesin"
                        value={temp == null ? '—' : `${fmtNum(temp / 10, 1)} °C`}
                    />
                    <Cell label="Pedal gas" value={n(82) == null ? '—' : `${n(82)}%`} />
                    <Cell
                        label="Konsumsi"
                        value={n(110) == null ? '—' : `${fmtNum(n(110)! / 10, 1)} L/jam`}
                    />
                </Grid>
                {!hasEngineCan && (
                    <Empty>RPM, suhu, pedal, dan konsumsi muncul setelah CAN terpasang.</Empty>
                )}
            </SensorCard>

            <SensorCard title="Supir" source="penugasan shift + iButton (1-Wire)">
                <Grid>
                    <Cell label="Bertugas" value={job?.driverName ?? 'Nganggur'} />
                    <Cell label="ID iButton" value={ibutton ?? '—'} mono />
                </Grid>
            </SensorCard>

            <SensorCard title="Bak & input" source="DIN2 / DIN3 / sensor suhu">
                <Grid>
                    <Cell
                        label="Pintu bak (DIN2)"
                        value={io[2] == null ? '—' : io[2] ? 'Terbuka' : 'Tertutup'}
                        warn={Boolean(io[2])}
                    />
                    <Cell
                        label="Input 3 (DIN3)"
                        value={io[3] == null ? '—' : io[3] ? 'Aktif' : 'Nonaktif'}
                    />
                    <Cell
                        label="Suhu bak"
                        value={cargoTemp == null ? '—' : `${fmtNum(cargoTemp / 10, 1)} °C`}
                    />
                </Grid>
                {io[2] == null && cargoTemp == null && (
                    <Empty>
                        Sambung sensor pintu ke DIN2 dan sensor suhu ke 1-Wire kalau perlu.
                    </Empty>
                )}
            </SensorCard>

            <EngineCut d={d} />
        </section>
    );
}

function EngineCut({ d }: { d: Device }) {
    const toast = useToast();
    const [confirm, setConfirm] = useState<'on' | 'off' | null>(null);
    const [busy, setBusy] = useState(false);
    const can = useCan();
    const command = useMutationApiRequest<GlobalApiResponse<{ response: string }>, { cmd: string }>(
        { key: 'devices-command', params: { imei: d.imei }, config: SILENT },
    );
    const active = Number(d.io[179] ?? 0) === 1;
    const speed = d.last?.speed ?? 0;
    const moving = speed > 5;

    let blocked: string | null = null;
    if (!can(P.deviceCommand)) blocked = 'Akun ini nggak punya akses kirim perintah ke alat.';
    else if (!d.online) blocked = 'Perintah cuma bisa dikirim pas koneksi alat terbuka.';
    else if (moving && !active)
        blocked = `Truk lagi jalan ${speed} km/jam. Matiin mesin cuma boleh pas truk berhenti.`;

    const send = async (on: boolean) => {
        setBusy(true);
        try {
            const r = (await command.mutateAsync({ cmd: `setdigout ${on ? 1 : 0}` })).data;
            toast({
                title: on ? 'Pemutus mesin diaktifkan' : 'Pemutus mesin dilepas',
                body: `Balasan alat: ${r?.response ?? '-'}`,
                level: on ? 'warn' : 'info',
            });
        } catch (e) {
            toast({ title: 'Perintah gagal', body: errText(e), level: 'crit' });
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    return (
        <SensorCard title="Pemutus mesin" source="DOUT1 → relay">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={active ? 'destructive' : 'muted'}>
                    {active ? 'Aktif, mesin diputus' : 'Tidak aktif'}
                </Badge>
                <Button
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    disabled={Boolean(blocked) || busy}
                    onClick={() => setConfirm(active ? 'off' : 'on')}
                >
                    <Power /> {active ? 'Lepas pemutus' : 'Putus mesin'}
                </Button>
            </div>
            <Empty>
                {blocked ??
                    'Perlu relay pemutus di kabel DOUT1. Kalau relay belum kepasang, perintah tetap jalan tapi mesin nggak kepengaruh.'}
            </Empty>
            <ConfirmDialog
                open={confirm != null}
                onOpenChange={(o) => !o && setConfirm(null)}
                title={confirm === 'on' ? 'Putus mesin truk ini?' : 'Lepas pemutus mesin?'}
                description={
                    confirm === 'on'
                        ? 'Mesin bakal mati dan nggak bisa dinyalain sampai pemutus dilepas.'
                        : 'Mesin bisa dinyalain lagi setelah ini.'
                }
                confirmLabel={confirm === 'on' ? 'Ya, putus mesin' : 'Ya, lepas'}
                destructive={confirm === 'on'}
                onConfirm={() => void send(confirm === 'on')}
            />
        </SensorCard>
    );
}

function SensorCard({
    title,
    source,
    empty = false,
    emptyText,
    children,
}: {
    title: string;
    source: string;
    empty?: boolean;
    emptyText?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-xl border bg-card p-3.5',
                empty && 'border-dashed',
            )}
        >
            <div className="flex items-baseline justify-between gap-2">
                <b className="text-sm">{title}</b>
                <span className="text-[11px] text-muted-foreground">{source}</span>
            </div>
            {empty ? <Empty>{emptyText}</Empty> : children}
        </div>
    );
}

function Grid({ children }: { children: ReactNode }) {
    return <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</div>;
}

function Cell({
    label,
    value,
    mono = false,
    warn = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
    warn?: boolean;
}) {
    return (
        <div className="flex min-w-0 flex-col">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <span
                className={cn(
                    'truncate text-[13.5px] font-medium',
                    mono && 'font-mono text-xs',
                    warn && 'text-warning',
                )}
            >
                {value}
            </span>
        </div>
    );
}
