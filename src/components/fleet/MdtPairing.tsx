'use client';
// Tablet MDT di kabin unit ini: bikin kode pairing 6 digit, lihat & cabut tablet yang terpasang.
import { useEffect, useState } from 'react';
import { TabletSmartphone, X } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { useToast } from '@/components/fleet/Toasts';
import { errText } from '@/lib/api-error';
import { ago, fmtHm } from '@/lib/format';
import { Button } from '@/components/ui/button';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { Device, MdtTablet } from '@/types/fleet';

export default function MdtPairing({ d }: { d: Device }) {
    const toast = useToast();
    const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const tablets = useQueryApiRequest<GlobalApiResponse<MdtTablet[]>>({
        key: 'devices-mdt',
        params: { imei: d.imei },
        config: { errorNotification: false },
    });
    const pair = useMutationApiRequest<
        GlobalApiResponse<{ code: string; expiresAt: number }>,
        void
    >({ key: 'devices-mdt-pair', params: { imei: d.imei }, config: SILENT });
    const revoke = useMutationApiRequest<
        GlobalApiResponse<{ id: string }>,
        { __params: { id: string } }
    >({ key: 'mdt-tablets-revoke', config: SILENT });

    useEffect(() => {
        if (!code) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [code]);

    const newCode = async () => {
        try {
            const r = await pair.mutateAsync();
            setCode(r.data ?? null);
            setNow(Date.now());
        } catch (err) {
            toast({ title: 'Gagal bikin kode', body: errText(err), level: 'crit' });
        }
    };

    const left = code ? Math.max(0, Math.round((code.expiresAt - now) / 1000)) : 0;
    const active = (tablets.data?.data ?? []).filter((t) => !t.revokedAt);

    return (
        <section className="mt-2 rounded-xl border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
                <TabletSmartphone className="size-4" /> Tablet MDT (kabin)
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
                Operator lapor status (P2H, Ishoma, Sholat, Antre, Breakdown…) dari tablet. Buka
                aplikasi fms-mdt di tablet, lalu masukkan kode ini.
            </p>
            {code && left > 0 ? (
                <div className="mt-3 flex items-center gap-4 rounded-lg bg-brand-soft p-3">
                    <span className="font-mono text-3xl font-bold tracking-[0.3em]">
                        {code.code}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        berlaku {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
                    </span>
                </div>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    onClick={() => void newCode()}
                    disabled={pair.isPending}
                >
                    {pair.isPending ? 'Membuat kode…' : 'Buat kode pairing'}
                </Button>
            )}
            {active.length > 0 && (
                <ul className="mt-3 divide-y text-sm">
                    {active.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                            <span>
                                <b>{t.name || 'Tablet'}</b>
                                <span className="block text-muted-foreground">
                                    Dipasang {t.pairedAt ? fmtHm(t.pairedAt) : '-'} · sync terakhir{' '}
                                    {t.lastSyncAt ? ago(t.lastSyncAt) : 'belum'}
                                </span>
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                    revoke.mutateAsync({ __params: { id: t.id } }).then(
                                        () =>
                                            toast({
                                                title: 'Tablet dicabut',
                                                body: 'Tablet harus pairing ulang sebelum bisa dipakai.',
                                                level: 'warn',
                                            }),
                                        (err) =>
                                            toast({
                                                title: 'Gagal mencabut',
                                                body: errText(err),
                                                level: 'crit',
                                            }),
                                    )
                                }
                            >
                                <X /> Cabut
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
