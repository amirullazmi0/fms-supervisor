'use client';
// Istirahat terjadwal (P2-3) di shift / template shift: jam mulai–selesai + delay code (standby
// terencana, mis. Ishoma). Selama istirahat, unit yang bertugas otomatis berstatus standby terencana.
import { Plus, X } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { DelayCode, ShiftBreak } from '@/types/fleet';

export default function BreaksEditor({
    value,
    onChange,
    disabled,
}: {
    value: ShiftBreak[];
    onChange: (v: ShiftBreak[]) => void;
    disabled?: boolean;
}) {
    const codes = useQueryApiRequest<GlobalApiResponse<DelayCode[]>>({
        key: 'delay-codes',
        config: { errorNotification: false },
    });
    // Istirahat = standby terencana (Ishoma, Sholat, P2H, ...).
    const options = (codes.data?.data ?? [])
        .filter((c) => c.active && c.category === 'standby_planned')
        .map((c) => ({ value: c.code, label: c.name }));
    const put = (i: number, b: Partial<ShiftBreak>) =>
        onChange(value.map((x, j) => (j === i ? { ...x, ...b } : x)));

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 flex w-full items-center justify-between text-sm text-muted-foreground">
                <span>Istirahat terjadwal</span>
                {!disabled && value.length < 8 && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            onChange([
                                ...value,
                                {
                                    start: '12:00',
                                    end: '13:00',
                                    code:
                                        options.find((o) => o.value === 'ISHOMA')?.value ??
                                        options[0]?.value ??
                                        'ISHOMA',
                                },
                            ])
                        }
                    >
                        <Plus /> Istirahat
                    </Button>
                )}
            </legend>
            {value.length === 0 ? (
                <p className="m-0 text-xs text-muted-foreground">
                    Belum ada. Selama istirahat, unit yang bertugas otomatis berstatus standby
                    terencana, lalu kembali ke status sebelumnya.
                </p>
            ) : (
                value.map((b, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1.4fr_auto] items-center gap-2">
                        <Input
                            type="time"
                            value={b.start}
                            onChange={(e) => put(i, { start: e.target.value })}
                            aria-label="Mulai istirahat"
                            disabled={disabled}
                            required
                        />
                        <Input
                            type="time"
                            value={b.end}
                            onChange={(e) => put(i, { end: e.target.value })}
                            aria-label="Selesai istirahat"
                            disabled={disabled}
                            required
                        />
                        <SimpleSelect
                            value={b.code}
                            onChange={(v) => put(i, { code: v })}
                            options={options.length ? options : [{ value: b.code, label: b.code }]}
                            aria-label="Delay code istirahat"
                            disabled={disabled}
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Hapus istirahat"
                            disabled={disabled}
                            onClick={() => onChange(value.filter((_, j) => j !== i))}
                        >
                            <X />
                        </Button>
                    </div>
                ))
            )}
        </fieldset>
    );
}
