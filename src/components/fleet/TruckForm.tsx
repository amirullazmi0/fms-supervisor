'use client';
// Dialog ubah info truk (plat, nama, jenis) + hapus truk beserta semua datanya.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/components/fleet/Toasts';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import type { GlobalApiResponse } from '@/types/api/responses';
import { truckLabel } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Device } from '@/types/fleet';

export default function TruckForm({ d, open, onOpenChange }: { d: Device; open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ plate: '', name: '', vehicle: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const can = useCan();
  const update = useMutationApiRequest<GlobalApiResponse<Device>, typeof form>({ key: 'devices-update', params: { imei: d.imei }, config: SILENT });
  const del = useMutationApiRequest<GlobalApiResponse<{ imei: string }>, void>({ key: 'devices-delete', params: { imei: d.imei }, config: SILENT });
  useEffect(() => {
    if (open) setForm({ plate: d.plate ?? '', name: d.name ?? '', vehicle: d.vehicle ?? '' });
  }, [open, d]);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await update.mutateAsync(form);
      toast({ title: 'Info truk disimpan', body: form.plate || form.name || d.imei });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Gagal nyimpen', body: errText(err), level: 'crit' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await del.mutateAsync();
      toast({ title: 'Truk dihapus', body: `${truckLabel(d)} dihapus dari daftar. Riwayat GPS-nya tetap disimpan buat laporan.`, level: 'warn' });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Gagal ngehapus', body: errText(err), level: 'crit' });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
            <DialogHeader>
              <DialogTitle>Info truk</DialogTitle>
              <DialogDescription className="font-mono">IMEI {d.imei}</DialogDescription>
            </DialogHeader>
            <Field label="Plat nomor"><Input value={form.plate} onChange={set('plate')} placeholder="B 1234 XYZ" autoComplete="off" autoFocus /></Field>
            <Field label="Nama / kode truk"><Input value={form.name} onChange={set('name')} placeholder="Truk 01" autoComplete="off" /></Field>
            <Field label="Jenis kendaraan"><Input value={form.vehicle} onChange={set('vehicle')} placeholder="Hino Ranger FM 260" autoComplete="off" /></Field>
            <DialogFooter className="sm:justify-between">
              {can(P.deviceDelete) ? (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Hapus truk</Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus ${truckLabel(d)}?`}
        description="Truk ini hilang dari daftar. Record GPS-nya tetap disimpan buat laporan lama; kalau alatnya konek lagi, truk muncul lagi."
        confirmLabel="Ya, hapus truk"
        destructive
        onConfirm={() => void remove()}
      />
    </>
  );
}
