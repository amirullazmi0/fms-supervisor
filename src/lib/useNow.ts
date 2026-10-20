'use client';
import { useEffect, useState } from 'react';

// Jam sekarang yang diperbarui tiap `ms` (untuk "12 mnt lalu", durasi, sisa waktu). Render tetap
// murni: waktu datang dari state, bukan Date.now() di tengah render.
export function useNow(ms = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(t);
    }, [ms]);
    return now;
}
