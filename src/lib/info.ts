// Fitur "Info & panduan" (info_tips) dari tabel fitur: menentukan apakah tombol info (i) tampil.
// Dibaca sekali dan disegarkan lewat stream "features" saat admin mengubahnya.
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import type { GlobalApiResponse } from '@/types/api/responses';

interface FeatureFlag {
    key: string;
    enabled: boolean;
}

export const INFO_TIPS = 'info_tips';

export function useInfoTips(): boolean {
    const q = useQueryApiRequest<GlobalApiResponse<FeatureFlag[]>>({
        key: 'features',
        config: { errorNotification: false },
        options: { staleTime: 10 * 60_000 },
    });
    return q.data?.data?.find((f) => f.key === INFO_TIPS)?.enabled ?? false;
}
