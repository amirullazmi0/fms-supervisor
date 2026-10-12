'use client';
// Previous / next pager driven by the `meta` of a GlobalApiResponse.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GlobalApiResponse } from '@/types/api/responses';

export default function Pager({ meta, onPage }: { meta: GlobalApiResponse['meta']; onPage: (page: number) => void }) {
    if (!meta || meta.total_page <= 1) {
        return meta ? <span className="text-xs text-muted-foreground">{meta.total_data} data</span> : null;
    }
    const { current_page: page, total_page: pages, total_data: total } = meta;
    return (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
                Halaman {page} dari {pages} · {total} data
            </span>
            <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                    <ChevronLeft /> Sebelumnya
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
                    Berikutnya <ChevronRight />
                </Button>
            </div>
        </div>
    );
}
