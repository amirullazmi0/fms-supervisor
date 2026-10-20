'use client';
// Supervisor / dispatcher mengisi status unit (mis. operator lapor lewat radio: "DT-05 BD ban").
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { useToast } from '@/components/fleet/Toasts';
import { useData } from '@/provider/StreamProvider';
import { errText } from '@/lib/api-error';
import { truckLabel } from '@/lib/format';
import { DELAY_CATEGORY, DELAY_TONE } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { DelayCategory, DelayCode, UnitStatusLog } from '@/types/fleet';

const ORDER: DelayCategory[] = ['working', 'standby_planned', 'standby_unplanned', 'breakdown'];

export default function SetUnitStatus({
    imei,
    open,
    onOpenChange,
}: {
    imei?: string;
    open: boolean;
    onOpenChange: (o: boolean) => void;
}) {
    const toast = useToast();
    const { devices } = useData();
    const [unit, setUnit] = useState(imei ?? '');
    const [code, setCode] = useState('');
    const [note, setNote] = useState('');
    const codes = useQueryApiRequest<GlobalApiResponse<DelayCode[]>>({
        key: 'delay-codes',
        config: { errorNotification: false },
    });
    const save = useMutationApiRequest<GlobalApiResponse<UnitStatusLog>, object>({
        key: 'unit-status-set',
        config: SILENT,
    });
    const grouped = useMemo(
        () =>
            ORDER.map((c) => ({
                c,
                list: (codes.data?.data ?? []).filter((d) => d.category === c),
            })),
        [codes.data],
    );

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!unit || !code) return;
        try {
            await save.mutateAsync({ imei: unit, delayCode: code, note: note.trim() || null });
            toast({
                title: 'Status unit disimpan',
                body: `${devices[unit] ? truckLabel(devices[unit]) : unit}: ${codes.data?.data?.find((d) => d.code === code)?.name ?? code}`,
            });
            onOpenChange(false);
        } catch (err) {
            toast({ title: 'Gagal nyimpen status', body: errText(err), level: 'crit' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
                <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
                    <DialogHeader>
                        <DialogTitle>Input status unit</DialogTitle>
                        <DialogDescription>
                            Dicatat sebagai sumber &quot;Supervisor&quot;, mulai sekarang. Dasar
                            perhitungan PA &amp; UA.
                        </DialogDescription>
                    </DialogHeader>
                    <Field label="Unit">
                        <Combobox
                            value={unit}
                            onChange={setUnit}
                            options={Object.values(devices).map((d) => ({
                                value: d.imei,
                                label: truckLabel(d),
                                hint: d.vehicle ?? undefined,
                            }))}
                            placeholder="Pilih unit"
                        />
                    </Field>
                    {grouped.map(
                        ({ c, list }) =>
                            list.length > 0 && (
                                <fieldset key={c} className="flex flex-col gap-2">
                                    <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {DELAY_CATEGORY[c]}
                                    </legend>
                                    <div className="flex flex-wrap gap-2">
                                        {list.map((d) => (
                                            <button
                                                key={d.code}
                                                type="button"
                                                onClick={() => setCode(d.code)}
                                                aria-pressed={code === d.code}
                                                className={cn(
                                                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                                                    code === d.code
                                                        ? cn(
                                                              DELAY_TONE[c],
                                                              'border-transparent ring-2 ring-current',
                                                          )
                                                        : 'bg-card hover:bg-muted',
                                                )}
                                            >
                                                {d.name}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>
                            ),
                    )}
                    <Field label="Catatan (opsional)">
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={200}
                            placeholder="mis. lapor via radio, ban kanan belakang bocor"
                        />
                    </Field>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={!unit || !code || save.isPending}>
                            {save.isPending ? 'Menyimpan…' : 'Simpan status'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
