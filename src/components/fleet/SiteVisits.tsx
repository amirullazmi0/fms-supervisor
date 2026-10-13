'use client';
// Laporan → waktu di titik loading / unloading: rata-rata + daftar mentah tiap kali truk
// ada di titik (masuk, keluar, lama). Truk yang masih di dalam ikut dihitung sampai sekarang.
import { useState } from 'react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import Pager from '@/components/custom/pager';
import { fmtDuration, fmtHm } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Empty,
    Stat,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { DwellStats, SiteVisitRecord, VisitReport } from '@/types/fleet/visits';

type Role = 'all' | 'loading' | 'unloading';

const PER_PAGE = 20;
const day = (ms: number) =>
    new Date(ms).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

export default function SiteVisits({ query }: { query: string }) {
    const [role, setRole] = useState<Role>('all');
    // Page resets when the period/filter or the role changes.
    const [paging, setPaging] = useState({ key: '', page: 1 });
    const pageKey = `${query}|${role}`;
    const page = paging.key === pageKey ? paging.page : 1;
    const base = Object.fromEntries(new URLSearchParams(query));
    const quiet = { errorNotification: false };

    // Refreshed by StreamProvider when ritase / stays change.
    const statsQ = useQueryApiRequest<GlobalApiResponse<VisitReport>>({
        key: 'reports-visits',
        queries: base,
        config: quiet,
    });
    const listQ = useQueryApiRequest<GlobalApiResponse<SiteVisitRecord[]>>({
        key: 'reports-visits-list',
        queries: {
            ...base,
            ...(role === 'all' ? {} : { role }),
            limit: PER_PAGE,
            offset: (page - 1) * PER_PAGE,
        },
        config: quiet,
        options: { placeholderData: (prev) => prev },
    });
    const stats = statsQ.data?.data ?? null;
    const rows = listQ.isLoading ? null : (listQ.data?.data ?? []);

    return (
        <Card className="gap-3 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4">
                <h2 className="m-0 text-base font-semibold">Waktu di titik loading & unloading</h2>
                <ToggleGroup
                    type="single"
                    value={role}
                    onValueChange={(v) => v && setRole(v as Role)}
                    aria-label="Jenis titik"
                >
                    <ToggleGroupItem value="all">Semua</ToggleGroupItem>
                    <ToggleGroupItem value="loading">Loading</ToggleGroupItem>
                    <ToggleGroupItem value="unloading">Unloading</ToggleGroupItem>
                </ToggleGroup>
            </div>
            {stats && (
                <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4">
                    <Avg label="Rata-rata di loading" s={stats.loading} />
                    <Stat
                        label="Terlama di loading"
                        value={
                            stats.loading.maxDwellMs ? fmtDuration(stats.loading.maxDwellMs) : '—'
                        }
                        sub={
                            stats.loading.inside
                                ? `${stats.loading.inside} truk lagi di dalam`
                                : undefined
                        }
                    />
                    <Avg label="Rata-rata di unloading" s={stats.unloading} />
                    <Stat
                        label="Terlama di unloading"
                        value={
                            stats.unloading.maxDwellMs
                                ? fmtDuration(stats.unloading.maxDwellMs)
                                : '—'
                        }
                        sub={
                            stats.unloading.inside
                                ? `${stats.unloading.inside} truk lagi di dalam`
                                : undefined
                        }
                    />
                </div>
            )}
            {rows == null ? (
                <Empty className="px-4 pb-4">Memuat…</Empty>
            ) : rows.length === 0 ? (
                <Empty className="px-4 pb-4">
                    Belum ada truk yang mampir di titik loading / unloading di periode ini.
                </Empty>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Truk</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Shift</TableHead>
                            <TableHead>Rute</TableHead>
                            <TableHead>Titik</TableHead>
                            <TableHead>Masuk</TableHead>
                            <TableHead>Keluar</TableHead>
                            <TableHead className="text-right">Lama</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((v) => (
                            <TableRow key={v.id}>
                                <TableCell className="whitespace-nowrap">
                                    {day(v.arriveAt)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap font-mono text-xs">
                                    {v.truck}
                                </TableCell>
                                <TableCell>{v.driverName ?? '—'}</TableCell>
                                <TableCell>{v.shiftName ?? '—'}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                    {v.routeName ?? '—'}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                    <Badge variant={v.role === 'loading' ? 'success' : 'warning'}>
                                        {v.role === 'loading' ? 'Loading' : 'Unloading'}
                                    </Badge>{' '}
                                    {v.siteName}
                                </TableCell>
                                <TableCell className="tabular-nums">{fmtHm(v.arriveAt)}</TableCell>
                                <TableCell className="tabular-nums">
                                    {v.departAt ? (
                                        fmtHm(v.departAt)
                                    ) : v.status === 'finished' ? (
                                        <Badge variant="muted">Selesai (shift beres)</Badge>
                                    ) : (
                                        <Badge variant="info">Masih di dalam</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {fmtDuration(v.dwellMs)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            <div className="border-t px-4 py-3">
                <Pager
                    meta={listQ.data?.meta}
                    onPage={(p) => setPaging({ key: pageKey, page: p })}
                />
            </div>
        </Card>
    );
}

function Avg({ label, s }: { label: string; s: DwellStats }) {
    return (
        <Stat
            label={label}
            value={s.visits ? fmtDuration(s.avgDwellMs) : '—'}
            sub={`${s.visits}× selesai`}
            big
        />
    );
}
