'use client';
// Kelola template shift: nama, jam mulai–selesai, tutup otomatis, dan istirahat terjadwal (P2-3).
// Template dipakai sebagai isian cepat saat membuat shift; istirahatnya ikut disalin ke shift.
import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { useData } from '@/provider/StreamProvider';
import { useToast } from '@/components/fleet/Toasts';
import BreaksEditor from '@/components/fleet/BreaksEditor';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Switch } from '@/components/ui/checkbox';
import { Empty } from '@/components/ui/misc';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { ShiftBreak, ShiftTemplate } from '@/types/fleet';

type Form = {
    name: string;
    startTime: string;
    endTime: string;
    autoClose: boolean;
    sort: number;
    breaks: ShiftBreak[];
};

const formOf = (t?: ShiftTemplate): Form => ({
    name: t?.name ?? '',
    startTime: t?.startTime ?? '06:00',
    endTime: t?.endTime ?? '18:00',
    autoClose: t?.autoClose ?? true,
    sort: t?.sort ?? 0,
    breaks: t?.breaks ?? [],
});

export default function TemplateManager({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
}) {
    const { templates } = useData();
    const can = useCan();
    const toast = useToast();
    const [editing, setEditing] = useState<ShiftTemplate | 'new' | null>(null);
    const [form, setForm] = useState<Form>(formOf());
    const [saving, setSaving] = useState(false);
    const editingId = editing && editing !== 'new' ? editing.id : '';

    const create = useMutationApiRequest<GlobalApiResponse<ShiftTemplate>, Form>({
        key: 'shift-templates-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<ShiftTemplate>, Form>({
        key: 'shift-templates-update',
        params: () => ({ id: editingId }),
        config: SILENT,
    });
    const remove = useMutationApiRequest<GlobalApiResponse<null>, { __params: { id: string } }>({
        key: 'shift-templates-delete',
        config: SILENT,
    });

    const edit = (t?: ShiftTemplate) => {
        setForm(formOf(t));
        setEditing(t ?? 'new');
    };
    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = { ...form, name: form.name.trim() };
            if (editing === 'new') await create.mutateAsync(body);
            else await update.mutateAsync(body);
            toast({ title: `Template ${body.name} disimpan` });
            setEditing(null);
        } catch (err) {
            toast({ title: 'Gagal menyimpan template', body: errText(err), level: 'crit' });
        } finally {
            setSaving(false);
        }
    };
    const del = async (t: ShiftTemplate) => {
        try {
            await remove.mutateAsync({ __params: { id: t.id } });
            toast({ title: `Template ${t.name} dihapus` });
        } catch (err) {
            toast({ title: 'Gagal menghapus template', body: errText(err), level: 'crit' });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) setEditing(null);
                onOpenChange(o);
            }}
        >
            <DialogContent className="sm:max-w-xl">
                {editing ? (
                    <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
                        <DialogHeader>
                            <DialogTitle>
                                {editing === 'new'
                                    ? 'Template baru'
                                    : `Ubah template ${editing.name}`}
                            </DialogTitle>
                            <DialogDescription>
                                Perubahan template tidak mengubah shift yang sudah dibuat.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nama">
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Pagi"
                                    maxLength={40}
                                    required
                                    autoComplete="off"
                                />
                            </Field>
                            <Field label="Urutan">
                                <Input
                                    type="number"
                                    value={form.sort}
                                    onChange={(e) =>
                                        setForm({ ...form, sort: Number(e.target.value) || 0 })
                                    }
                                />
                            </Field>
                            <Field label="Mulai">
                                <Input
                                    type="time"
                                    value={form.startTime}
                                    onChange={(e) =>
                                        setForm({ ...form, startTime: e.target.value })
                                    }
                                    required
                                />
                            </Field>
                            <Field label="Selesai">
                                <Input
                                    type="time"
                                    value={form.endTime}
                                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                                    required
                                />
                            </Field>
                        </div>
                        <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
                            Tutup otomatis di jam selesai
                            <Switch
                                checked={form.autoClose}
                                onCheckedChange={(v) => setForm({ ...form, autoClose: v })}
                            />
                        </label>
                        <BreaksEditor
                            value={form.breaks}
                            onChange={(breaks) => setForm({ ...form, breaks })}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditing(null)}
                            >
                                Kembali
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Menyimpan…' : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </form>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Template shift</DialogTitle>
                            <DialogDescription>
                                Isian cepat saat membuat shift, termasuk istirahat terjadwal.
                            </DialogDescription>
                        </DialogHeader>
                        {templates.length === 0 ? (
                            <Empty>Belum ada template.</Empty>
                        ) : (
                            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                {templates.map((t) => (
                                    <li
                                        key={t.id}
                                        className="flex items-center gap-3 rounded-lg border p-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <b>{t.name}</b>{' '}
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {t.startTime}–{t.endTime}
                                            </span>
                                            <p className="m-0 truncate text-xs text-muted-foreground">
                                                {t.breaks?.length
                                                    ? `Istirahat: ${t.breaks.map((b) => `${b.start}–${b.end} ${b.code}`).join(', ')}`
                                                    : 'Tanpa istirahat terjadwal'}
                                            </p>
                                        </div>
                                        {can(P.shiftTemplateUpdate) && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                aria-label={`Ubah ${t.name}`}
                                                onClick={() => edit(t)}
                                            >
                                                <Pencil />
                                            </Button>
                                        )}
                                        {can(P.shiftTemplateDelete) && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                aria-label={`Hapus ${t.name}`}
                                                onClick={() => void del(t)}
                                            >
                                                <Trash2 />
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <DialogFooter>
                            {can(P.shiftTemplateCreate) && (
                                <Button onClick={() => edit()}>
                                    <Plus /> Template
                                </Button>
                            )}
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
