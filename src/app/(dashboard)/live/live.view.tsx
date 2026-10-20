'use client';
// Live (GPRS): peta, status, riwayat, event, dan perintah untuk alat yang kirim data lewat 4G.
import { useEffect, useMemo, useState } from 'react';
import { Copy, LocateFixed, Server } from 'lucide-react';
import FleetMap from '@/components/fleet/FleetMap';
import DeviceDetail, { useDeviceHistory } from '@/components/fleet/DeviceDetail';
import EventList from '@/components/fleet/EventList';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import { useData, useTick } from '@/provider/StreamProvider';
import { ago, displayName, lastHeard, statusOf } from '@/lib/format';
import type { Status } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { Empty, KV, Tip } from '@/components/ui/misc';

const DOT: Record<Status, string> = {
    moving: 'bg-info',
    idle: 'bg-warning',
    parked: 'bg-muted-foreground',
    offline: 'bg-destructive',
};

export default function LiveView() {
    const { devices, events, io, groups, status, cmdLog, ready } = useData();
    const { setStats } = useLayout();
    useTick(1000);

    const list = useMemo(
        () =>
            Object.values(devices).sort(
                (a, b) =>
                    Number(b.online) - Number(a.online) ||
                    displayName(a).localeCompare(displayName(b)),
            ),
        [devices],
    );
    const [selected, setSelected] = useState<string | null>(null);
    const [rangeMin, setRangeMin] = useState('60');
    const [follow, setFollow] = useState(true);
    const [search, setSearch] = useState('');

    // Pilih alat pertama (yang online lebih dulu) bila belum ada yang dipilih.
    useEffect(() => {
        if (!selected && list.length) setSelected(list[0].imei);
    }, [list, selected]);

    const windowed = useDeviceHistory(selected, rangeMin);

    // Ringkasan di header.
    const counts = useMemo(() => {
        const c: Record<Status, number> = { moving: 0, idle: 0, parked: 0, offline: 0 };
        list.forEach((d) => c[statusOf(d)]++);
        return c;
    }, [list]);
    const critHour = events.filter(
        (e) => e.level === 'crit' && Date.now() - e.time < 3600e3,
    ).length;
    const online = list.length - counts.offline;
    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Aktif" value={`${online}/${list.length}`} />
                <HeaderStat label="Jalan" value={counts.moving} />
                <HeaderStat label="Idle" value={counts.idle} />
                <HeaderStat label="Parkir" value={counts.parked} />
                {critHour > 0 && (
                    <HeaderStat label="Event kritis 1 jam" value={critHour} tone="danger" />
                )}
            </>,
        );
    }, [setStats, online, list.length, counts, critHour]);
    useEffect(() => () => setStats(null), [setStats]);

    const d = selected ? devices[selected] : undefined;
    const q = search.trim().toLowerCase();
    const filtered = list.filter(
        (x) => !q || x.imei.includes(q) || displayName(x).toLowerCase().includes(q),
    );

    return (
        <div className="grid gap-4 p-4 md:p-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
                <ServerCard />

                <Card className="gap-3" aria-labelledby="devTitle">
                    <CardHeader>
                        <CardTitle id="devTitle">Unit</CardTitle>
                        <CardDescription>{list.length} unit</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <SearchInput
                            placeholder="Cari unit atau IMEI"
                            aria-label="Cari unit"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <ul className="m-0 flex list-none flex-col gap-1 p-0">
                            {filtered.length === 0 && (
                                <li>
                                    <Empty>
                                        {list.length ? 'Tidak ada yang cocok.' : 'Belum ada unit.'}
                                    </Empty>
                                </li>
                            )}
                            {filtered.map((x) => {
                                const st = statusOf(x);
                                const sel = x.imei === selected;
                                return (
                                    <li key={x.imei}>
                                        <button
                                            type="button"
                                            aria-pressed={sel}
                                            onClick={() => setSelected(x.imei)}
                                            className={cn(
                                                'grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-0.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted',
                                                sel && 'bg-info-soft hover:bg-info-soft',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'row-span-2 size-2.5 rounded-full',
                                                    DOT[st],
                                                )}
                                                aria-hidden="true"
                                            />
                                            <b className="truncate text-sm">{displayName(x)}</b>
                                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                                {st === 'offline'
                                                    ? 'offline'
                                                    : `${x.last?.speed ?? 0} km/h`}
                                            </span>
                                            <span className="col-span-2 truncate text-xs text-muted-foreground">
                                                {x.imei} · {ago(lastHeard(x))}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </CardContent>
                </Card>

                <Card className="gap-3">
                    <CardHeader>
                        <CardTitle>Event terbaru</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-96 overflow-y-auto">
                        <EventList
                            events={events.slice(-60).reverse()}
                            devices={devices}
                            withName
                            empty="Belum ada event."
                        />
                    </CardContent>
                </Card>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
                <div className="relative isolate h-[52dvh] min-h-[300px] overflow-hidden rounded-2xl border">
                    <FleetMap
                        devices={list}
                        selected={selected}
                        onSelect={setSelected}
                        trail={windowed}
                        follow={follow}
                    />
                    <Button
                        variant="outline"
                        className={cn(
                            'absolute right-3 top-3 z-[1000] shadow-lg',
                            follow && 'border-ring',
                        )}
                        aria-pressed={follow}
                        onClick={() => setFollow(!follow)}
                    >
                        <LocateFixed /> Ikuti unit
                    </Button>
                </div>

                {ready && list.length === 0 && (
                    <Card className="px-5">
                        <h2 className="m-0 text-lg font-semibold">
                            Belum ada unit yang kirim data
                        </h2>
                        <p className="m-0 text-sm text-muted-foreground">
                            Atur FMC150 agar mengirim ke server ini melalui SMS (dari HP Android,
                            diawali 2 spasi):{' '}
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                                setparam 2004:{status?.tunnel?.host ?? '<domain>'};2005:
                                {status?.tunnel?.port ?? '<port>'}
                            </code>
                            . Protokol TCP, Codec 8 Extended.
                        </p>
                        <p className="m-0 text-sm text-muted-foreground">
                            Untuk mencoba dashboard terlebih dahulu, jalankan simulator:{' '}
                            <code className="font-mono text-foreground">
                                go run ./cmd/simulator
                            </code>
                        </p>
                    </Card>
                )}

                {d && (
                    <DeviceDetail
                        key={d.imei}
                        d={d}
                        io={io}
                        groups={groups}
                        history={windowed}
                        rangeMin={rangeMin}
                        onRange={setRangeMin}
                        events={events
                            .filter((e) => e.imei === d.imei)
                            .slice(-50)
                            .reverse()}
                        devices={devices}
                        cmdLines={cmdLog.filter((l) => l.imei === d.imei)}
                    />
                )}
            </div>
        </div>
    );
}

function ServerCard() {
    const { status: s } = useData();
    const toast = useToast();
    if (!s) return null;
    // Perintah SMS bila alamat tunnel berganti. Disalin tanpa 2 spasi depan:
    // spasinya harus diketik manual (iPhone/aplikasi chat membuang spasi di awal).
    const sms = s.tunnel ? `setparam 2004:${s.tunnel.host};2005:${s.tunnel.port}` : null;
    const copySms = async () => {
        if (!sms) return;
        try {
            await navigator.clipboard.writeText(sms);
            toast({
                title: 'Perintah SMS disalin',
                body: 'Kirim dari HP Android ke nomor SIM alat. Ketik 2 spasi terlebih dahulu, lalu tempel.',
            });
        } catch {
            toast({ title: 'Tidak dapat menyalin otomatis', body: sms, level: 'warn' });
        }
    };
    return (
        <Card className="gap-3" aria-labelledby="srvTitle">
            <CardHeader>
                <CardTitle id="srvTitle" className="flex items-center gap-2">
                    <Server className="size-4 text-muted-foreground" /> Server penerima
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Alamat alat</span>
                    {s.tunnel ? (
                        <>
                            <b className="font-mono text-[15px]">
                                {s.tunnel.host}:{s.tunnel.port}
                            </b>
                            <span className="text-xs text-muted-foreground">
                                {s.tunnel.provider === 'manual'
                                    ? 'alamat server'
                                    : `tunnel ${s.tunnel.provider === 'bore' ? 'bore.pub' : 'ngrok'}`}
                                , isi di Domain/Port alat
                            </span>
                        </>
                    ) : s.tunnelEnabled ? (
                        <span className="flex flex-col items-start gap-1">
                            <Badge variant="warning">Tunnel mati</Badge>
                            <span className="text-xs text-muted-foreground">
                                Alat hanya dapat terhubung dari jaringan lokal.
                            </span>
                        </span>
                    ) : (
                        <span className="flex flex-col items-start gap-1">
                            <b className="font-mono text-[15px]">
                                &lt;IP/domain server&gt;:{s.devicePort}
                            </b>
                            <span className="text-xs text-muted-foreground">
                                tanpa tunnel, alat terhubung langsung ke server. Isi TUNNEL_HOST di
                                backend agar alamatnya tampil di sini.
                            </span>
                        </span>
                    )}
                </div>
                {sms && (
                    <div className="flex flex-col gap-1.5 rounded-lg bg-muted p-2.5">
                        <span className="text-xs text-muted-foreground">
                            SMS ke alat (kirim ulang bila alamat berubah)
                        </span>
                        <span className="break-all font-mono text-xs">
                            <Tip label="2 spasi, ketik manual">
                                <span className="mr-0.5 rounded bg-brand px-1 text-brand-foreground">
                                    ␣␣
                                </span>
                            </Tip>
                            {sms}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            onClick={() => void copySms()}
                        >
                            <Copy /> Salin perintah
                        </Button>
                    </div>
                )}
                <KV
                    rows={[
                        ['Port dashboard', <span className="font-mono">{s.port}</span>],
                        ['Unit tersambung', <span className="font-mono">{s.connected}</span>],
                    ]}
                />
            </CardContent>
        </Card>
    );
}
