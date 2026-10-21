'use client';
// Zona batas kecepatan & overspeed (P3-3): kelola zona (turunan, crossing, area tongkang) di peta,
// lalu laporan overspeed per operator. Overspeed live muncul sebagai notifikasi.
import { useMemo, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Trash2 } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { PageHeader } from '@/components/fleet/Page';
import { ChartCard } from '@/components/fleet/Charts';
import { useToast } from '@/components/fleet/Toasts';
import { ZONE_KIND } from '@/components/fleet/SpeedZoneMap';
import { useData } from '@/provider/StreamProvider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
    Empty,
    Note,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import { SimpleSelect } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { errText } from '@/lib/api-error';
import { addDays, dateKey, fmtDateTime, fmtDuration } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { OverspeedReport, SpeedZone } from '@/types/fleet';

const SpeedZoneMap = dynamic(() => import('@/components/fleet/SpeedZoneMap'), { ssr: false });

type Form = {
    name: string;
    kind: SpeedZone['kind'];
    lat: string;
    lng: string;
    radius: string;
    limitKmh: string;
    active: boolean;
};
const EMPTY: Form = {
    name: '',
    kind: 'downhill',
    lat: '',
    lng: '',
    radius: '150',
    limitKmh: '20',
    active: true,
};
type Range = 'today' | '7d' | '30d';

export default function SpeedZonesView() {
    const { sites } = useData();
    const can = useCan();
    const canEdit = can(P.speedZoneManage);
    const toast = useToast();
    const zones = useQueryApiRequest<GlobalApiResponse<SpeedZone[]>>({ key: 'speed-zones' });
    const [editing, setEditing] = useState<SpeedZone | 'new' | null>(null);
    const [form, setForm] = useState<Form>(EMPTY);
    const [range, setRange] = useState<Range>('7d');
    const editId = editing && editing !== 'new' ? editing.id : '';

    const create = useMutationApiRequest<GlobalApiResponse<null>, object>({
        key: 'speed-zones-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<null>, object>({
        key: 'speed-zones-update',
        params: () => ({ id: editId }),
        config: SILENT,
    });
    const remove = useMutationApiRequest<GlobalApiResponse<null>, { __params: { id: string } }>({
        key: 'speed-zones-delete',
        config: SILENT,
    });

    const queries = useMemo(() => {
        const today = dateKey();
        const from = range === 'today' ? today : addDays(today, range === '7d' ? -6 : -29);
        return { from: new Date(`${from}T00:00:00`).getTime() };
    }, [range]);
    const report = useQueryApiRequest<GlobalApiResponse<OverspeedReport>>({
        key: 'reports-overspeed',
        queries,
        options: { refetchInterval: 60000 },
    });

    const edit = (z?: SpeedZone) => {
        setEditing(z ?? 'new');
        setForm(
            z
                ? {
                      name: z.name,
                      kind: z.kind,
                      lat: String(z.lat),
                      lng: String(z.lng),
                      radius: String(z.radius),
                      limitKmh: String(z.limitKmh),
                      active: z.active,
                  }
                : EMPTY,
        );
    };
    const num = (s: string) => Number(s.replace(',', '.'));
    const draft =
        editing && form.lat && form.lng
            ? { lat: num(form.lat), lng: num(form.lng), radius: num(form.radius) || 100 }
            : null;

    const save = async (e: FormEvent) => {
        e.preventDefault();
        const body = {
            name: form.name.trim(),
            kind: form.kind,
            lat: num(form.lat),
            lng: num(form.lng),
            radius: Math.round(num(form.radius)),
            limitKmh: Math.round(num(form.limitKmh)),
            active: form.active,
        };
        try {
            if (editing === 'new') await create.mutateAsync(body);
            else await update.mutateAsync(body);
            toast({ title: `Zona ${body.name} disimpan` });
            setEditing(null);
        } catch (err) {
            toast({ title: 'Gagal menyimpan zona', body: errText(err), level: 'crit' });
        }
    };
    const del = async (z: SpeedZone) => {
        try {
            await remove.mutateAsync({ __params: { id: z.id } });
            toast({ title: `Zona ${z.name} dihapus` });
            setEditing(null);
        } catch (err) {
            toast({ title: 'Gagal menghapus zona', body: errText(err), level: 'crit' });
        }
    };

    const list = zones.data?.data ?? [];
    const rep = report.data?.data;

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 md:p-5">
            <PageHeader
                title="Zona kecepatan & overspeed"
                description="Batas kecepatan di turunan, crossing, dan area tongkang. Unit yang melebihi batas di dalam zona memicu notifikasi dan tercatat per operator."
                actions={
                    canEdit && !editing ? (
                        <Button onClick={() => edit()}>
                            <Plus /> Zona
                        </Button>
                    ) : undefined
                }
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="h-[460px]">
                    <SpeedZoneMap
                        zones={list}
                        sites={sites}
                        draft={draft}
                        onPick={(lat, lng) =>
                            editing &&
                            setForm({ ...form, lat: lat.toFixed(6), lng: lng.toFixed(6) })
                        }
                        onSelect={(z) => canEdit && edit(z)}
                    />
                </div>
                {editing ? (
                    <form
                        className="flex flex-col gap-3 rounded-xl border bg-card p-4"
                        onSubmit={(e) => void save(e)}
                    >
                        <h2 className="m-0 text-sm font-semibold">
                            {editing === 'new' ? 'Zona baru' : `Ubah ${editing.name}`}
                        </h2>
                        <Note tone="info">Klik peta untuk memilih titik tengah zona.</Note>
                        <Field label="Nama">
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Turunan KM 5"
                                maxLength={60}
                                required
                            />
                        </Field>
                        <Field label="Jenis">
                            <SimpleSelect
                                value={form.kind}
                                onChange={(v) => setForm({ ...form, kind: v as SpeedZone['kind'] })}
                                aria-label="Jenis zona"
                                options={(Object.keys(ZONE_KIND) as SpeedZone['kind'][]).map(
                                    (k) => ({
                                        value: k,
                                        label: ZONE_KIND[k].label,
                                    }),
                                )}
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Batas (km/jam)">
                                <Input
                                    value={form.limitKmh}
                                    onChange={(e) => setForm({ ...form, limitKmh: e.target.value })}
                                    inputMode="numeric"
                                    required
                                />
                            </Field>
                            <Field label="Radius (m)">
                                <Input
                                    value={form.radius}
                                    onChange={(e) => setForm({ ...form, radius: e.target.value })}
                                    inputMode="numeric"
                                    required
                                />
                            </Field>
                            <Field label="Lat">
                                <Input
                                    value={form.lat}
                                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                                    inputMode="decimal"
                                    required
                                />
                            </Field>
                            <Field label="Lng">
                                <Input
                                    value={form.lng}
                                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                                    inputMode="decimal"
                                    required
                                />
                            </Field>
                        </div>
                        <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
                            Aktif
                            <Switch
                                checked={form.active}
                                onCheckedChange={(v) => setForm({ ...form, active: v })}
                            />
                        </label>
                        <div className="flex flex-wrap justify-between gap-2">
                            {editing !== 'new' ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => void del(editing)}
                                >
                                    <Trash2 /> Hapus
                                </Button>
                            ) : (
                                <span />
                            )}
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditing(null)}
                                >
                                    Batal
                                </Button>
                                <Button type="submit" disabled={!form.lat || !form.lng}>
                                    Simpan
                                </Button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                        <h2 className="m-0 text-sm font-semibold">Daftar zona</h2>
                        {list.length === 0 ? (
                            <Empty>
                                Belum ada zona. Tambahkan zona di turunan, crossing, atau area
                                tongkang.
                            </Empty>
                        ) : (
                            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                {list.map((z) => (
                                    <li key={z.id}>
                                        <button
                                            type="button"
                                            disabled={!canEdit}
                                            onClick={() => edit(z)}
                                            className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] hover:bg-muted disabled:hover:bg-transparent"
                                        >
                                            <i
                                                className="size-3 shrink-0 rounded-full"
                                                style={{ background: ZONE_KIND[z.kind].color }}
                                            />
                                            <span className="min-w-0 flex-1 truncate">
                                                <b>{z.name}</b>{' '}
                                                <span className="text-muted-foreground">
                                                    {ZONE_KIND[z.kind].label}
                                                    {z.active ? '' : ' · nonaktif'}
                                                </span>
                                            </span>
                                            <b className="tabular-nums">{z.limitKmh} km/jam</b>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 mr-auto text-base font-semibold">Overspeed di zona</h2>
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
            </div>
            {!rep ? (
                <Empty>Memuat…</Empty>
            ) : rep.episodes.length === 0 ? (
                <Empty>Tidak ada overspeed di zona pada periode ini.</Empty>
            ) : (
                <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
                    <ChartCard title="Per operator">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Operator</TableHead>
                                    <TableHead className="text-right">Kejadian</TableHead>
                                    <TableHead className="text-right">Lebih maks</TableHead>
                                    <TableHead className="text-right">Durasi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rep.drivers.map((d) => (
                                    <TableRow key={d.driverName}>
                                        <TableCell className="font-medium">
                                            {d.driverName}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {d.episodes}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-destructive">
                                            +{d.maxOver} km/jam
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmtDuration(d.totalMs)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ChartCard>
                    <ChartCard
                        title="Kejadian"
                        hint={rep.truncated ? 'Data terpotong, persempit periode.' : undefined}
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Operator</TableHead>
                                    <TableHead>Zona</TableHead>
                                    <TableHead className="text-right">Maks / batas</TableHead>
                                    <TableHead className="text-right">Durasi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rep.episodes.slice(0, 200).map((e) => (
                                    <TableRow key={`${e.imei}|${e.zoneId}|${e.startAt}`}>
                                        <TableCell>{fmtDateTime(e.startAt)}</TableCell>
                                        <TableCell className="font-medium">{e.unit}</TableCell>
                                        <TableCell>{e.driverName ?? '—'}</TableCell>
                                        <TableCell>{e.zoneName}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            <b className="text-destructive">{e.maxSpeed}</b> /{' '}
                                            {e.limitKmh}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmtDuration(e.endAt - e.startAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ChartCard>
                </div>
            )}
        </div>
    );
}
