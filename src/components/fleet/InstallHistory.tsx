'use client';
// Riwayat pemasangan tracker (IMEI) ke unit (plat). Tercatat otomatis setiap plat unit diganti
// (tracker dipindah ke unit lain), jadi laporan periode lama tetap tahu unit mana yang dipakai.
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { fmtDateTime } from '@/lib/format';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { DeviceInstall } from '@/types/fleet';

export default function InstallHistory({ imei }: { imei: string }) {
    const q = useQueryApiRequest<GlobalApiResponse<DeviceInstall[]>>({
        key: 'devices-installs',
        params: { imei },
        config: { errorNotification: false },
    });
    const list = q.data?.data ?? [];
    return (
        <section className="flex flex-col gap-2 border-t pt-4">
            <h3 className="m-0 text-sm font-semibold">Riwayat pemasangan tracker</h3>
            {list.length === 0 ? (
                <p className="m-0 text-xs text-muted-foreground">
                    Belum ada. Tercatat otomatis saat plat unit diisi atau diganti.
                </p>
            ) : (
                <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                    {list.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-baseline gap-x-2">
                            <b>{x.plate}</b>
                            {x.name && <span className="text-muted-foreground">{x.name}</span>}
                            <span className="text-xs text-muted-foreground">
                                {fmtDateTime(x.installedAt)} –{' '}
                                {x.removedAt ? fmtDateTime(x.removedAt) : 'sekarang'}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
