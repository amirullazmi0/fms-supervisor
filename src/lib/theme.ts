// Pilihan tema: ikut sistem, terang, atau gelap. Disimpan per browser.
'use client';
import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_KEY = 'fmc.theme';

// Dark mode is switched off for now (light only). The dark tokens in globals.css and the
// switch below stay; set NEXT_PUBLIC_DARK_MODE=true to bring the theme menu back.
export const DARK_MODE_ENABLED = process.env.NEXT_PUBLIC_DARK_MODE === 'true';

export function readTheme(): ThemeMode {
    if (!DARK_MODE_ENABLED) return 'light';
    if (typeof window === 'undefined') return 'system';
    try {
        const v = localStorage.getItem(THEME_KEY);
        // Default light (same look in every FMS app); 'system' only when chosen.
        return v === 'dark' || v === 'system' ? v : 'light';
    } catch {
        return 'system';
    }
}

// Tailwind/shadcn pakai kelas `dark` di <html>. "system" mengikuti setelan OS (dan ikut berubah bila OS berganti).
const media =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function applyTheme(mode: ThemeMode): void {
    const dark = mode === 'dark' || (mode === 'system' && Boolean(media?.matches));
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function persist(mode: ThemeMode): void {
    try {
        if (mode === 'light') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, mode);
    } catch {
        /* storage tidak tersedia, tema tetap terpasang untuk sesi ini */
    }
}

export function useTheme(): [ThemeMode, (mode: ThemeMode) => void] {
    // Start from 'system' on both server and client (no hydration mismatch), then read the saved choice.
    const [mode, setMode] = useState<ThemeMode>('light');
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        setMode(readTheme());
        setLoaded(true);
    }, []);
    useEffect(() => {
        if (!loaded) return;
        applyTheme(mode);
        persist(mode);
        if (mode !== 'system' || !media) return;
        const onChange = () => applyTheme('system');
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [mode, loaded]);
    return [mode, setMode];
}
