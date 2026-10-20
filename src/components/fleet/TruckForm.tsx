'use client';
// Dialog ubah info unit (plat / nomor lambung, nama, jenis, truck factor) + pairing tablet MDT
// + hapus unit beserta semua datanya.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/components/fleet/Toasts';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import { UNIT_TYPE } from '@/lib/labels';
import type { GlobalApiResponse } from '@/types/api/responses';
import { truckLabel } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { SimpleSelect } from '@/components/ui/select';
import {
    ConfirmDialog,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import MdtPairing from '@/components/fleet/MdtPairing';
import type { Device, UnitType } from '@/types/fleet';

interface Form {
    plate: string;
    name: string;
    vehicle: string;
    payloadTon: string;
    unitType: UnitType;
}

export default function TruckForm({
    d,
    open,
    onOpenChange,
}: {
    d: Device;
    open: boolean;
    onOpenChange: (o: boolean) => void;
}) {
    const toast = useToast();
    const [form, setForm] = useState<Form>({
        plate: '',
        name: '',
        vehicle: '',
        payloadTon: '20',
        unitType: 'DT',
    });
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saving, setSaving] = useState(false);
    const can = useCan();
    const update = useMutationApiRequest<GlobalApiResponse<Device>, object>({
        key: 'devices-update',
        params: { imei: d.imei },
        config: SILENT,
    });
    const del = useMutationApiRequest<GlobalApiResponse<{ imei: string }>, void>({
        key: 'devices-delete',
        params: { imei: d.imei },
        config: SILENT,
    });
    useEffect(() => {
        if (open) {
            setForm({
                plate: d.plate ?? '',
                name: d.name ?? '',
                vehicle: d.vehicle ?? '',
                payloadTon: String(d.payloadTon ?? 20),
                unitType: d.unitType ?? 'DT',
            });
        }
    }, [open, d]);
    const set = (k: keyof Form) => (e: { target: { value: string } }) =>
        setForm({ ...form, [k]: e.target.value });
    const payload = Number(form.payloadTon.replace(',', '.'));
    const payloadError = !(payload > 0 && payload <= 500) ? 'Isi 0–500 ton' : undefined;

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (payloadError) return;
        setSaving(true);
        try {
            await update.mutateAsync({
                plate: form.plate,
                name: form.name,
                vehicle: form.vehicle,
                payloadTon: payload,
                unitType: form.unitType,
            });
            toast({ title: 'Info unit disimpan', body: form.plate || form.name || d.imei });
            onOpenChange(false);
        } catch (err) {
            toast({ title: 'Gagal menyimpan', body: errText(err), level: 'crit' });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        try {
            await del.mutateAsync();
            toast({
                title: 'Unit dihapus',
                body: `${truckLabel(d)} dihapus dari daftar. Riwayat GPS-nya tetap disimpan untuk laporan.`,
                level: 'warn',
            });
            onOpenChange(false);
        } catch (err) {
            toast({ title: 'Gagal menghapus', body: errText(err), level: 'crit' });
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
                        <DialogHeader>
                            <DialogTitle>Info unit</DialogTitle>
                            <DialogDescription className="font-mono">
                                IMEI {d.imei}
                            </DialogDescription>
                        </DialogHeader>
                        <Field label="Plat / nomor lambung">
                            <Input
                                value={form.plate}
                                onChange={set('plate')}
                                placeholder="DT-05"
                                autoComplete="off"
                                autoFocus
                            />
                        </Field>
                        <Field label="Nama / kode unit">
                            <Input
                                value={form.name}
                                onChange={set('name')}
                                placeholder="DT 05"
                                autoComplete="off"
                            />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Jenis unit">
                                <SimpleSelect
                                    value={form.unitType}
                                    onChange={(v) => setForm({ ...form, unitType: v as UnitType })}
                                    options={(Object.keys(UNIT_TYPE) as UnitType[]).map((k) => ({
                                        value: k,
                                        label: UNIT_TYPE[k],
                                    }))}
                                    aria-label="Jenis unit"
                                />
                            </Field>
                            <Field
                                label="Truck factor (ton / rit)"
                                hint="Muatan per rit. Tonase = ritase × truck factor."
                                error={payloadError}
                            >
                                <Input
                                    value={form.payloadTon}
                                    onChange={set('payloadTon')}
                                    inputMode="decimal"
                                    placeholder="20"
                                    autoComplete="off"
                                />
                            </Field>
                        </div>
                        <Field label="Merek / model">
                            <Input
                                value={form.vehicle}
                                onChange={set('vehicle')}
                                placeholder="Hino FM 260 JD"
                                autoComplete="off"
                            />
                        </Field>
                        <DialogFooter className="sm:justify-between">
                            {can(P.deviceDelete) ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setConfirmDelete(true)}
                                >
                                    <Trash2 /> Hapus unit
                                </Button>
                            ) : (
                                <span />
                            )}
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Batal
                                </Button>
                                <Button type="submit" disabled={saving || !!payloadError}>
                                    {saving ? 'Menyimpan…' : 'Simpan'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                    {can(P.mdtManage) && open && <MdtPairing d={d} />}
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={`Hapus ${truckLabel(d)}?`}
                description="Unit ini dihapus dari daftar. Record GPS-nya tetap disimpan untuk laporan lama; bila alatnya terhubung kembali, unit akan muncul lagi."
                confirmLabel="Ya, hapus unit"
                destructive
                onConfirm={() => void remove()}
            />
        </>
    );
}
