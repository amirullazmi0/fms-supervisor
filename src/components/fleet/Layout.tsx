'use client';
// Kerangka app: sidebar gelap (bisa diciutkan; di HP jadi laci), konten di panel terang membulat,
// header berisi judul halaman + ringkasan dari halaman (setStats) + status live.
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import {
    Activity,
    Flame,
    Shuffle,
    Bell,
    CalendarClock,
    ChartColumn,
    Container,
    Gauge,
    HardHat,
    LayoutDashboard,
    LogOut,
    MapPin,
    Menu,
    Monitor,
    Moon,
    PanelLeftClose,
    PanelLeftOpen,
    Radio,
    Sun,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useData, useStream } from '@/provider/StreamProvider';
import type { LiveState } from '@/provider/StreamProvider';
import { displayName } from '@/lib/format';
import { DARK_MODE_ENABLED, useTheme } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';
import { useAuth } from '@/hooks/react-query/useAuth';
import { P } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth.store';
import type { Permission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { APP } from '@/lib/app';
import { SheetContent } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, Tip } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { notify, useToast } from '@/components/fleet/Toasts';

const LIVE_TEXT: Record<LiveState, string> = {
    connecting: 'Menghubungkan…',
    on: 'Live',
    off: 'Koneksi server terputus, mencoba kembali…',
};

interface LayoutContext {
    setStats: (node: ReactNode) => void;
}

const LayoutCtx = createContext<LayoutContext>({ setStats: () => {} });

// Halaman dapat mengisi ringkasan di header melalui hook ini.
export const useLayout = () => useContext(LayoutCtx);

// Menu hanya menampilkan halaman yang boleh dibuka role user (permission).
// Dikelompokkan sesuai kerja dispatcher. `bottom` = muncul di bar bawah HP (maks 4).
type NavGroup = 'Operasional' | 'Produksi' | 'Penugasan' | 'Master data';
const NAV: {
    to: string;
    label: string;
    short?: string;
    icon: LucideIcon;
    end?: boolean;
    need: Permission[];
    group: NavGroup;
    bottom?: boolean;
}[] = [
    {
        to: '/',
        label: 'Beranda',
        icon: LayoutDashboard,
        end: true,
        need: [P.deviceRead, P.shiftRead, P.reportRead],
        group: 'Operasional',
        bottom: true,
    },
    {
        to: '/track',
        label: 'Lacak unit',
        short: 'Lacak',
        icon: Truck,
        need: [P.deviceRead],
        group: 'Operasional',
        bottom: true,
    },
    {
        to: '/dispatch',
        label: 'Panel dispatcher',
        short: 'Dispatch',
        icon: Shuffle,
        need: [P.shiftRead, P.reportRead],
        group: 'Operasional',
    },
    { to: '/live', label: 'Live (GPRS)', icon: Radio, need: [P.deviceRead], group: 'Operasional' },
    {
        to: '/production',
        label: 'Produksi per jam',
        short: 'Produksi',
        icon: Gauge,
        need: [P.reportRead],
        group: 'Produksi',
        bottom: true,
    },
    {
        to: '/heatmap',
        label: 'Heat map jalan',
        icon: Flame,
        need: [P.reportRead],
        group: 'Produksi',
    },
    {
        to: '/availability',
        label: 'PA & UA',
        icon: Activity,
        need: [P.reportRead],
        group: 'Produksi',
    },
    {
        to: '/reports',
        label: 'Laporan ritase',
        icon: ChartColumn,
        need: [P.reportRead],
        group: 'Produksi',
    },
    {
        to: '/shifts',
        label: 'Shift & penugasan',
        short: 'Shift',
        icon: CalendarClock,
        need: [P.shiftRead],
        group: 'Penugasan',
        bottom: true,
    },
    {
        to: '/operators',
        label: 'Operator',
        icon: HardHat,
        need: [P.driverRead],
        group: 'Penugasan',
    },
    {
        to: '/fleet',
        label: 'Armada & MDT',
        icon: Container,
        need: [P.deviceRead],
        group: 'Master data',
    },
    {
        to: '/sites',
        label: 'Front, dumping & rute',
        icon: MapPin,
        need: [P.siteRead, P.routeRead],
        group: 'Master data',
    },
];
const GROUPS: NavGroup[] = ['Operasional', 'Produksi', 'Penugasan', 'Master data'];

const THEMES: { mode: ThemeMode; label: string; icon: LucideIcon }[] = [
    { mode: 'system', label: 'Ikut sistem', icon: Monitor },
    { mode: 'light', label: 'Terang', icon: Sun },
    { mode: 'dark', label: 'Gelap', icon: Moon },
];

const COLLAPSE_KEY = 'fmc.sidebar';
const noopSubscribe = () => () => {};

function readCollapsed(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(COLLAPSE_KEY) === 'mini';
    } catch {
        return false;
    }
}

export default function Layout({ children }: { children: ReactNode }) {
    const { live } = useData();
    const pathname = usePathname();
    const [stats, setStats] = useState<ReactNode>(null);
    const [mini, setMini] = useState(false);
    useEffect(() => setMini(readCollapsed()), []);
    const [open, setOpen] = useState(false); // laci menu di HP

    useEffect(() => setOpen(false), [pathname]);

    const toggleMini = () => {
        setMini((v) => {
            try {
                localStorage.setItem(COLLAPSE_KEY, v ? 'full' : 'mini');
            } catch {
                /* gagal menyimpan, tidak masalah */
            }
            return !v;
        });
    };

    const page = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

    return (
        <div className="flex h-dvh bg-frame">
            <aside
                className={cn(
                    'hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
                    mini ? 'w-[68px]' : 'w-60',
                )}
                aria-label="Menu"
            >
                <SidebarBody mini={mini} onToggle={toggleMini} />
            </aside>

            <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
                <SheetContent
                    className="bg-sidebar text-sidebar-foreground"
                    aria-describedby={undefined}
                >
                    <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                    <SidebarBody mini={false} />
                </SheetContent>
            </DialogPrimitive.Root>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background md:my-2.5 md:mr-2.5 md:rounded-2xl">
                <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-3 py-2 md:px-5">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="md:hidden"
                        onClick={() => setOpen(true)}
                        aria-label="Buka menu"
                    >
                        <Menu />
                    </Button>
                    <h1 className="m-0 text-base font-semibold tracking-tight md:text-lg">
                        {page?.label ?? 'FMS'}
                    </h1>
                    <span
                        className={cn(
                            'hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide sm:inline',
                            APP.chip,
                        )}
                    >
                        {APP.label}
                    </span>
                    <div className="order-last flex w-full min-w-0 items-center gap-2 overflow-x-auto scrollbar-none empty:hidden md:order-none md:w-auto md:flex-1">
                        {stats}
                    </div>
                    <LiveBadge live={live} className="ml-auto md:ml-0" />
                </header>
                <GlobalNotifier />
                <main className="relative min-h-0 flex-1 overflow-auto">
                    <LayoutCtx.Provider value={{ setStats }}>{children}</LayoutCtx.Provider>
                </main>
                <BottomBar pathname={pathname} onMore={() => setOpen(true)} />
            </div>
        </div>
    );
}

// HP: 4 menu utama di bawah (jempol), sisanya lewat "Lainnya" (laci menu).
function BottomBar({ pathname, onMore }: { pathname: string; onMore: () => void }) {
    const user = useAuthStore((s) => s.user);
    const can = (p: Permission) =>
        !user?.permissions || user.is_administrator || user.permissions.includes(p);
    const items = NAV.filter((n) => n.bottom && n.need.some(can)).slice(0, 4);
    const cell =
        'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium';
    return (
        <nav
            className="flex shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
            aria-label="Menu utama"
        >
            {items.map((n) => {
                const active = n.end ? pathname === n.to : pathname.startsWith(n.to);
                return (
                    <Link
                        key={n.to}
                        href={n.to}
                        className={cn(cell, active ? 'text-foreground' : 'text-muted-foreground')}
                    >
                        <n.icon className={cn('size-5', active && 'text-brand')} />
                        {n.short ?? n.label}
                    </Link>
                );
            })}
            <button type="button" onClick={onMore} className={cn(cell, 'text-muted-foreground')}>
                <Menu className="size-5" /> Lainnya
            </button>
        </nav>
    );
}

function LiveBadge({ live, className }: { live: LiveState; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground',
                className,
            )}
            title="Koneksi live ke server"
        >
            <i
                className={cn(
                    'size-2 rounded-full',
                    live === 'on'
                        ? 'bg-success shadow-[0_0_0_3px_var(--success-soft)]'
                        : live === 'off'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground',
                )}
            />
            <span className="max-sm:hidden">{LIVE_TEXT[live]}</span>
        </span>
    );
}

// Angka ringkasan di header (dipakai halaman lewat setStats).
export function HeaderStat({
    label,
    value,
    tone,
}: {
    label: string;
    value: ReactNode;
    tone?: 'danger';
}) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-baseline gap-1.5 rounded-full border bg-secondary px-3 py-1 text-xs text-muted-foreground',
                tone === 'danger' && 'border-transparent bg-danger-soft text-destructive',
            )}
        >
            {label} <b className="font-mono text-[13px] text-foreground tabular-nums">{value}</b>
        </span>
    );
}

// Isi sidebar (dipakai sidebar desktop dan laci HP).
function SidebarBody({ mini, onToggle }: { mini: boolean; onToggle?: () => void }) {
    const { user: profile, logout } = useAuth();
    // Profile not loaded yet (or the server is unreachable): use the user saved at login.
    const stored = useAuthStore((s) => s.user);
    // The server has no stored user; read it only after hydration so both renders match.
    const hydrated = useSyncExternalStore(
        noopSubscribe,
        () => true,
        () => false,
    );
    const user = hydrated ? (profile ?? stored) : null;
    // Unknown permissions = show every page; the API still refuses what the role cannot do.
    const can = (p: Permission) =>
        !user?.permissions || user.is_administrator || user.permissions.includes(p);
    const pathname = usePathname();
    const [mode, setMode] = useTheme();
    const [perm, setPerm] = useState<NotificationPermission>('denied');
    useEffect(() => {
        if ('Notification' in window) setPerm(Notification.permission);
    }, []);
    const ThemeIcon = THEMES.find((t) => t.mode === mode)!.icon;

    const navItem = (to: string, label: string, Icon: LucideIcon, end?: boolean) => {
        const isActive = end ? pathname === to : pathname.startsWith(to);
        const link = (
            <Link
                key={to}
                href={to}
                className={cn(
                    'group flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-strong',
                    isActive && 'bg-sidebar-accent text-sidebar-strong shadow-sm',
                    mini && 'justify-center px-0',
                )}
            >
                <Icon className={cn('size-[18px] shrink-0', isActive && 'text-brand')} />
                {!mini && <span className="truncate">{label}</span>}
            </Link>
        );
        return mini ? (
            <Tip key={to} label={label}>
                {link}
            </Tip>
        ) : (
            link
        );
    };

    const footBtn =
        'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-strong';

    return (
        <div className="flex h-full flex-col gap-4 p-3">
            <div
                className={cn(
                    'flex h-10 items-center gap-2.5 px-1.5',
                    mini && 'justify-center px-0',
                )}
            >
                <span
                    className={cn('grid size-8 shrink-0 place-items-center rounded-lg', APP.tile)}
                >
                    <APP.icon className="size-[18px]" />
                </span>
                {!mini && (
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <b className="truncate text-sm text-sidebar-strong">FMS</b>
                        <span className="text-[11px] text-sidebar-foreground/60">{APP.label}</span>
                    </span>
                )}
                {onToggle && !mini && (
                    <button
                        type="button"
                        onClick={onToggle}
                        className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-strong"
                        aria-label="Ciutkan menu"
                    >
                        <PanelLeftClose className="size-4" />
                    </button>
                )}
            </div>
            {onToggle && mini && (
                <button
                    type="button"
                    onClick={onToggle}
                    className="mx-auto -mt-2 rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-strong"
                    aria-label="Lebarkan menu"
                >
                    <PanelLeftOpen className="size-4" />
                </button>
            )}

            <nav className="flex min-h-0 flex-col gap-3 overflow-y-auto" aria-label="Halaman">
                {GROUPS.map((g) => {
                    const items = NAV.filter((n) => n.group === g && n.need.some(can));
                    if (!items.length) return null;
                    return (
                        <div key={g} className="flex flex-col gap-1">
                            {mini ? (
                                <i className="mx-3 border-t border-sidebar-border" />
                            ) : (
                                <span className="px-3 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                                    {g}
                                </span>
                            )}
                            {items.map((n) => navItem(n.to, n.label, n.icon, n.end))}
                        </div>
                    );
                })}
            </nav>

            <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-border pt-3">
                {perm === 'default' && !mini && (
                    <button
                        type="button"
                        className={footBtn}
                        onClick={async () => setPerm(await Notification.requestPermission())}
                    >
                        <Bell className="size-4" /> Aktifkan notifikasi
                    </button>
                )}

                {user ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    'mt-2 flex items-center gap-2.5 rounded-xl bg-sidebar-accent p-2 text-left outline-none hover:bg-sidebar-accent/80 focus-visible:ring-2 focus-visible:ring-brand/50',
                                    mini && 'justify-center',
                                )}
                                aria-label="Menu akun"
                            >
                                <Avatar name={user.name || user.email} />
                                {!mini && (
                                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                        <span className="truncate text-[13px] font-semibold text-sidebar-strong">
                                            {user.name || user.email}
                                        </span>
                                        <span className="text-[11px] text-sidebar-foreground/60">
                                            {user.role}
                                        </span>
                                    </span>
                                )}
                                {!mini && DARK_MODE_ENABLED && (
                                    <ThemeIcon className="size-4 text-sidebar-foreground/60" />
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="w-56">
                            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                            {DARK_MODE_ENABLED && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>Tema</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup
                                        value={mode}
                                        onValueChange={(v) => setMode(v as ThemeMode)}
                                    >
                                        {THEMES.map((t) => (
                                            <DropdownMenuRadioItem key={t.mode} value={t.mode}>
                                                <t.icon className="size-4" /> {t.label}
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => logout.mutate()}
                            >
                                <LogOut /> Keluar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <button
                        type="button"
                        className={cn(footBtn, 'mt-2', mini && 'justify-center px-0')}
                        onClick={() => logout.mutate()}
                        aria-label="Keluar"
                    >
                        <LogOut className="size-4" /> {!mini && 'Memuat akun… · Keluar'}
                    </button>
                )}
            </div>
        </div>
    );
}

// Notifikasi yang muncul di semua halaman: alat baru online, alamat tunnel ganti, event kritis.
function GlobalNotifier() {
    const toast = useToast();
    const { devices, status } = useData();

    // Alamat tunnel berubah = alat tidak akan terhubung sampai dikirimi alamat baru melalui SMS.
    const addr = status?.tunnel ? `${status.tunnel.host}:${status.tunnel.port}` : '';
    const prevAddr = useRef<string | null>(null);
    useEffect(() => {
        if (!status) return;
        const prev = prevAddr.current;
        prevAddr.current = addr;
        if (prev === null || prev === addr) return;
        if (!addr) {
            // Tunnel yang sengaja dimatikan (TUNNEL=false, sudah deploy) bukan masalah.
            if (status.tunnelEnabled)
                toast({
                    title: 'Tunnel mati',
                    body: 'Alat tidak dapat terhubung dari internet. Runner sedang mencoba membuat ulang tunnel.',
                    level: 'crit',
                });
            return;
        }
        const [host, port] = addr.split(':');
        toast({
            title: `Alamat alat berubah: ${addr}`,
            body: `Kirim SMS ke alat (2 spasi di depan): setparam 2004:${host};2005:${port}`,
            level: 'warn',
        });
        notify('Alamat alat berubah', addr);
    }, [addr, status, toast]);

    useStream((msg) => {
        if (
            msg.type === 'device' &&
            msg.device.online &&
            devices[msg.device.imei] &&
            !devices[msg.device.imei].online
        ) {
            toast({
                title: 'Unit online',
                body: `${displayName(msg.device)} (${msg.device.imei}) terhubung kembali.`,
            });
        } else if (msg.type === 'event' && msg.event.kind === 'new') {
            toast({
                title: 'Unit baru terdaftar',
                body: `Alat GPS IMEI ${msg.event.imei} ditambahkan ke database.`,
                actions: [{ label: 'Buka di Live', to: '/live' }],
            });
            notify('Unit baru terdaftar', msg.event.imei);
        } else if (msg.type === 'notice') {
            toast({
                title: msg.title,
                body: msg.body,
                level: msg.level,
                ...(msg.to ? { actions: [{ label: 'Buka', to: msg.to }] } : {}),
            });
            notify(msg.title, msg.body);
        } else if (msg.type === 'event' && msg.event.level === 'crit') {
            const d = devices[msg.event.imei];
            const who = d ? displayName(d) : msg.event.imei;
            toast({ title: msg.event.text, body: who, level: 'crit' });
            notify(msg.event.text, who);
        }
    });

    return null;
}
