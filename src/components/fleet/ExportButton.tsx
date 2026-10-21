'use client';
// Tombol ekspor laporan ke Excel (P3-8). Unduhan lewat BFF (/api), cookie sesi ikut terkirim.
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ExportType = 'ritase' | 'hourly' | 'availability' | 'operators' | 'breakdowns';

export default function ExportButton({
    type,
    from,
    to,
    extra,
}: {
    type: ExportType;
    from?: number;
    to?: number;
    extra?: Record<string, string>;
}) {
    const q = new URLSearchParams({ type, ...(extra ?? {}) });
    if (from) q.set('from', String(from));
    if (to) q.set('to', String(to));
    return (
        <Button asChild variant="outline" size="sm">
            <a href={`/api/reports/export?${q.toString()}`} download>
                <FileSpreadsheet /> Ekspor Excel
            </a>
        </Button>
    );
}
