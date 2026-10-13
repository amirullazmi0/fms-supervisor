'use client';
// Daftar driver: tambah, ubah, nonaktifkan. Driver nggak login, cuma data buat penugasan & laporan.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/fleet/Toasts';
import { useData } from '@/provider/StreamProvider';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import type { GlobalApiResponse } from '@/types/api/responses';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, SearchInput } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/checkbox';
import {
    ConfirmDialog,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, Empty } from '@/components/ui/misc';
import type { Driver } from '@/types/fleet';

interface Form {
    name: string;
    employeeNo: string;
    phone: string;
    ibutton: string;
    active: boolean;
    note: string;
}

const empty: Form = { name: '', employeeNo: '', phone: '', ibutton: '', active: true, note: '' };
const formOf = (d: Driver): Form => ({
    name: d.name,
    employeeNo: d.employeeNo ?? '',
    phone: d.phone ?? '',
    ibutton: d.ibutton ?? '',
    active: d.active,
    note: d.note ?? '',
});

export default function DriverManager({ canEdit }: { canEdit: boolean }) {
    const { drivers } = useData();
    const toast = useToast();
    const [q, setQ] = useState('');
    const [form, setForm] = useState<Form | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Driver | null>(null);
    const create = useMutationApiRequest<GlobalApiResponse<Driver>, Form>({
        key: 'drivers-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<Driver>, Form>({
        key: 'drivers-update',
        params: () => ({ id: editing ?? '' }),
        config: SILENT,
    });
    const del = useMutationApiRequest<
        GlobalApiResponse<{ result: 'deleted' | 'deactivated' }>,
        { __params: { id: string } }
    >({ key: 'drivers-delete', config: SILENT });

    const shown = drivers.filter(
        (d) =>
            !q ||
            `${d.name} ${d.employeeNo ?? ''} ${d.phone ?? ''}`
                .toLowerCase()
                .includes(q.toLowerCase()),
    );
    const set = <K extends keyof Form>(k: K, v: Form[K]) => form && setForm({ ...form, [k]: v });
    const close = () => {
        setForm(null);
        setEditing(null);
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!form) return;
        setSaving(true);
        try {
            const d = (editing ? await update.mutateAsync(form) : await create.mutateAsync(form))
                .data;
            toast({
                title: editing ? 'Driver diubah' : 'Driver ditambah',
                body: d?.name ?? form.name,
            });
            close();
        } catch (err) {
            toast({ title: 'Gagal nyimpen driver', body: errText(err), level: 'crit' });
        } finally {
            setSaving(false);
        }
    };

    const remove = async (d: Driver) => {
        try {
            const r = (await del.mutateAsync({ __params: { id: d.id } })).data!;
            toast({
                title: r.result === 'deleted' ? 'Driver dihapus' : 'Driver dinonaktifkan',
                body:
                    r.result === 'deleted'
                        ? d.name
                        : `${d.name} pernah ditugaskan, jadi datanya disimpan buat laporan.`,
                level: 'warn',
            });
        } catch (err) {
            toast({ title: 'Gagal', body: errText(err), level: 'crit' });
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <SearchInput
                    className="flex-1"
                    placeholder="Cari driver…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Cari driver"
                />
                {canEdit && (
                    <Button onClick={() => setForm({ ...empty })}>
                        <Plus /> Driver
                    </Button>
                )}
            </div>

            {drivers.length === 0 ? (
                <Empty>
                    {canEdit
                        ? 'Belum ada driver. Tambah dulu sebelum bikin penugasan shift.'
                        : 'Belum ada driver.'}
                </Empty>
            ) : shown.length === 0 ? (
                <Empty>Nggak ada driver yang cocok.</Empty>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {shown.map((d) => (
                        <li
                            key={d.id}
                            className={cn(
                                'flex items-center gap-3 rounded-xl border bg-card p-2.5',
                                !d.active && 'opacity-60',
                            )}
                        >
                            <Avatar name={d.name} />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex items-center gap-2">
                                    <b className="truncate text-sm">{d.name}</b>
                                    {!d.active && <Badge variant="muted">Nonaktif</Badge>}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {[d.employeeNo, d.phone].filter(Boolean).join(' · ') || '—'}
                                </span>
                            </span>
                            {canEdit && (
                                <span className="flex shrink-0 gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => {
                                            setEditing(d.id);
                                            setForm(formOf(d));
                                        }}
                                        aria-label={`Ubah ${d.name}`}
                                    >
                                        <Pencil />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => setToDelete(d)}
                                        aria-label={`Hapus ${d.name}`}
                                    >
                                        <Trash2 />
                                    </Button>
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <Dialog open={form != null} onOpenChange={(o) => !o && close()}>
                <DialogContent>
                    {form && (
                        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
                            <DialogHeader>
                                <DialogTitle>{editing ? 'Ubah driver' : 'Driver baru'}</DialogTitle>
                                <DialogDescription>
                                    Driver nggak login. Datanya dipakai buat penugasan shift dan
                                    laporan.
                                </DialogDescription>
                            </DialogHeader>
                            <Field label="Nama">
                                <Input
                                    value={form.name}
                                    onChange={(e) => set('name', e.target.value)}
                                    maxLength={60}
                                    required
                                    autoComplete="off"
                                    autoFocus
                                />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="No. karyawan">
                                    <Input
                                        value={form.employeeNo}
                                        onChange={(e) => set('employeeNo', e.target.value)}
                                        maxLength={30}
                                        autoComplete="off"
                                    />
                                </Field>
                                <Field label="No. HP">
                                    <Input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => set('phone', e.target.value)}
                                        maxLength={30}
                                        autoComplete="off"
                                    />
                                </Field>
                            </div>
                            <Field
                                label="ID iButton (opsional)"
                                hint="Kalau supir pakai kunci iButton di truk."
                            >
                                <Input
                                    className="font-mono"
                                    value={form.ibutton}
                                    onChange={(e) =>
                                        set('ibutton', e.target.value.replace(/[^0-9a-f]/gi, ''))
                                    }
                                    maxLength={16}
                                    autoComplete="off"
                                />
                            </Field>
                            <Field label="Catatan">
                                <Input
                                    value={form.note}
                                    onChange={(e) => set('note', e.target.value)}
                                    maxLength={200}
                                    autoComplete="off"
                                />
                            </Field>
                            <Label className="justify-between rounded-lg border p-3">
                                <span className="flex flex-col gap-1">
                                    <span>Aktif</span>
                                    <span className="text-xs font-normal text-muted-foreground">
                                        Driver nonaktif nggak muncul di pilihan penugasan.
                                    </span>
                                </span>
                                <Switch
                                    checked={form.active}
                                    onCheckedChange={(v) => set('active', v)}
                                />
                            </Label>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={close}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving ? 'Menyimpan…' : 'Simpan'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={toDelete != null}
                onOpenChange={(o) => !o && setToDelete(null)}
                title={`Hapus ${toDelete?.name ?? 'driver'}?`}
                description="Kalau driver ini pernah ditugaskan, datanya cuma dinonaktifkan biar laporan lama tetap utuh."
                confirmLabel="Hapus"
                destructive
                onConfirm={() => toDelete && void remove(toDelete)}
            />
        </div>
    );
}
