'use client';
// One live connection (SSE) to fms-backend for every page, plus the shared fleet data.
// Data lives in the react-query cache (useQueryApiRequest); stream messages patch the cache
// or trigger a refetch. Port of fmctest/web/src/lib/data.tsx.
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { redirectToLogin } from '@/lib/axios';
import { P, useCan } from '@/lib/permissions';
import type { IoTable } from '@/lib/format';
import type { GlobalApiResponse } from '@/types/api/responses';
import type {
    CommandLine,
    Device,
    Driver,
    FleetEvent,
    IoGroup,
    Route,
    ServerStatus,
    Shift,
    ShiftTemplate,
    Site,
    StreamMsg,
} from '@/types/fleet';

export type LiveState = 'connecting' | 'on' | 'off';

export interface DataState {
    ready: boolean;
    live: LiveState;
    io: IoTable;
    groups: Partial<Record<IoGroup, string>>;
    devices: Record<string, Device>;
    events: FleetEvent[];
    cmdLog: CommandLine[];
    status: ServerStatus | null;
    sites: Site[];
    routes: Route[];
    drivers: Driver[];
    templates: ShiftTemplate[];
    shifts: Shift[]; // today's shifts + every active one
}

type Listener = (msg: StreamMsg) => void;

interface DataContextValue extends DataState {
    subscribe: (fn: Listener) => () => void;
}

const DataCtx = createContext<DataContextValue | null>(null);

type R<T> = GlobalApiResponse<T>;
// Cache keys exactly as useQueryApiRequest builds them: [key, params, queries].
const KEY = {
    devices: ['devices', undefined, undefined],
    events: ['events', undefined, undefined],
    commands: ['commands', undefined, undefined],
} as const;

const cap = <T,>(arr: T[], item: T, max: number): T[] =>
    arr.length >= max ? [...arr.slice(arr.length - max + 1), item] : [...arr, item];
const EMPTY: never[] = [];

export default function StreamProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const can = useCan();
    const [live, setLive] = useState<LiveState>('connecting');
    const listeners = useRef(new Set<Listener>());
    const quiet = { errorNotification: false };

    const ioMap = useQueryApiRequest<R<{ io: IoTable; groups: DataState['groups'] }>>({
        key: 'io-map',
        config: quiet,
        options: { staleTime: Infinity },
    });
    const devices = useQueryApiRequest<R<Device[]>>({
        key: 'devices',
        config: quiet,
        options: { enabled: can(P.deviceRead) },
    });
    const events = useQueryApiRequest<R<FleetEvent[]>>({
        key: 'events',
        config: quiet,
        options: { enabled: can(P.deviceRead) },
    });
    const status = useQueryApiRequest<R<ServerStatus>>({
        key: 'status',
        config: quiet,
        options: { enabled: can(P.deviceRead), refetchInterval: 5000 },
    });
    const commands = useQueryApiRequest<R<CommandLine[]>>({
        key: 'commands',
        config: quiet,
        options: { enabled: can(P.logRead) || can(P.deviceCommand) },
    });
    const sites = useQueryApiRequest<R<Site[]>>({
        key: 'sites',
        config: quiet,
        options: { enabled: can(P.siteRead) },
    });
    const routes = useQueryApiRequest<R<Route[]>>({
        key: 'routes',
        config: quiet,
        options: { enabled: can(P.routeRead) },
    });
    const drivers = useQueryApiRequest<R<Driver[]>>({
        key: 'drivers',
        config: quiet,
        options: { enabled: can(P.driverRead) },
    });
    const templates = useQueryApiRequest<R<ShiftTemplate[]>>({
        key: 'shift-templates',
        config: quiet,
        options: { enabled: can(P.shiftTemplateRead) },
    });
    // "Overdue" and the day change are computed from the clock, so shifts reload every minute too.
    const shifts = useQueryApiRequest<R<Shift[]>>({
        key: 'shifts',
        config: quiet,
        options: { enabled: can(P.shiftRead), refetchInterval: 60000 },
    });

    useEffect(() => {
        const refetch = (...keys: string[]) =>
            keys.forEach((k) => void queryClient.refetchQueries({ queryKey: [k] }));
        const onMessage = (msg: StreamMsg) => {
            switch (msg.type) {
                case 'shifts':
                    refetch(
                        'shifts',
                        'drivers',
                        'shift-templates',
                        'sites',
                        'routes',
                        'shifts-by-id',
                        'dispatch-fleets',
                    );
                    break;
                case 'speed_zones':
                    refetch('speed-zones');
                    break;
                case 'dispatch':
                    refetch('dispatch-fleets');
                    break;
                case 'features':
                    refetch('features');
                    break;
                case 'sites':
                    refetch('sites', 'routes');
                    break;
                // Ritase/arrivals also move a truck from "finishing" to "done" (routes carry the duty phase).
                case 'trips':
                    refetch(
                        'reports',
                        'reports-trips',
                        'reports-visits',
                        'reports-visits-list',
                        'shifts-by-id',
                        'routes',
                        'reports-hourly',
                        'reports-stages',
                        'production-targets',
                    );
                    break;
                case 'unit_status':
                    refetch(
                        'unit-status',
                        'unit-status-current',
                        'dispatch-fleets',
                        'reports-breakdowns',
                    );
                    break;
                case 'device':
                    queryClient.setQueryData<R<Device[]>>(KEY.devices, (old) => {
                        const list = old?.data ?? [];
                        const i = list.findIndex((d) => d.imei === msg.device.imei);
                        const next =
                            i >= 0
                                ? list.map((d, k) => (k === i ? msg.device : d))
                                : [...list, msg.device];
                        return { success: true, message: old?.message ?? '', ...old, data: next };
                    });
                    break;
                case 'removed':
                    queryClient.setQueryData<R<Device[]>>(
                        KEY.devices,
                        (old) =>
                            old && {
                                ...old,
                                data: (old.data ?? []).filter((d) => d.imei !== msg.imei),
                            },
                    );
                    queryClient.setQueryData<R<FleetEvent[]>>(
                        KEY.events,
                        (old) =>
                            old && {
                                ...old,
                                data: (old.data ?? []).filter((e) => e.imei !== msg.imei),
                            },
                    );
                    break;
                case 'event':
                    queryClient.setQueryData<R<FleetEvent[]>>(
                        KEY.events,
                        (old) => old && { ...old, data: cap(old.data ?? [], msg.event, 300) },
                    );
                    break;
                case 'command': {
                    const { type: _t, ...line } = msg;
                    queryClient.setQueryData<R<CommandLine[]>>(
                        KEY.commands,
                        (old) => old && { ...old, data: cap(old.data ?? [], line, 500) },
                    );
                    break;
                }
                default:
                    break;
            }
            listeners.current.forEach((fn) => fn(msg));
        };

        // Read through the BFF (it adds the token from the httpOnly cookie and renews it).
        let stopped = false;
        let ctrl: AbortController | null = null;
        let attempt = 0;
        const connect = async () => {
            while (!stopped) {
                ctrl = new AbortController();
                try {
                    const res = await fetch('/api/stream', {
                        signal: ctrl.signal,
                        credentials: 'same-origin',
                    });
                    if (res.status === 401) {
                        stopped = true; // the BFF could not renew the session
                        redirectToLogin();
                        break;
                    }
                    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
                    setLive('on');
                    attempt = 0;
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buf = '';
                    for (;;) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buf += decoder.decode(value, { stream: true });
                        let cut: number;
                        while ((cut = buf.indexOf('\n\n')) >= 0) {
                            const chunk = buf.slice(0, cut);
                            buf = buf.slice(cut + 2);
                            const data = chunk
                                .split('\n')
                                .filter((l) => l.startsWith('data: '))
                                .map((l) => l.slice(6))
                                .join('\n');
                            if (data) onMessage(JSON.parse(data) as StreamMsg);
                        }
                    }
                } catch {
                    if (stopped) return;
                }
                setLive('off');
                attempt++;
                // Reconnect: 2 s, 4 s, … max 30 s. Data may have changed while away.
                await new Promise((r) =>
                    setTimeout(r, Math.min(30000, 2000 * 2 ** Math.min(attempt, 4))),
                );
                if (!stopped) refetch('devices', 'events', 'sites', 'routes', 'shifts');
            }
        };
        void connect();
        return () => {
            stopped = true;
            ctrl?.abort();
        };
    }, [queryClient]);

    // For components that need raw messages (e.g. history points, notifications).
    const subscribe = useCallback((fn: Listener) => {
        listeners.current.add(fn);
        return () => {
            listeners.current.delete(fn);
        };
    }, []);

    const deviceList = devices.data?.data;
    const value = useMemo<DataContextValue>(
        () => ({
            ready: !devices.isLoading && !ioMap.isLoading,
            live,
            io: ioMap.data?.data?.io ?? {},
            groups: ioMap.data?.data?.groups ?? {},
            devices: Object.fromEntries((deviceList ?? EMPTY).map((d: Device) => [d.imei, d])),
            events: events.data?.data ?? EMPTY,
            cmdLog: commands.data?.data ?? EMPTY,
            status: status.data?.data ?? null,
            sites: sites.data?.data ?? EMPTY,
            routes: routes.data?.data ?? EMPTY,
            drivers: drivers.data?.data ?? EMPTY,
            templates: templates.data?.data ?? EMPTY,
            shifts: shifts.data?.data ?? EMPTY,
            subscribe,
        }),
        [
            devices.isLoading,
            ioMap.isLoading,
            ioMap.data,
            live,
            deviceList,
            events.data,
            commands.data,
            status.data,
            sites.data,
            routes.data,
            drivers.data,
            templates.data,
            shifts.data,
            subscribe,
        ],
    );

    return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData(): DataContextValue {
    const ctx = useContext(DataCtx);
    if (!ctx) throw new Error('useData must be used inside <StreamProvider>');
    return ctx;
}

// Raw stream messages, with a handler that is always the latest version.
export function useStream(handler: Listener): void {
    const { subscribe } = useData();
    const ref = useRef(handler);
    useEffect(() => {
        ref.current = handler;
    });
    useEffect(() => subscribe((msg) => ref.current(msg)), [subscribe]);
}

// Re-render every `ms` (for "12 dtk lalu" texts).
export function useTick(ms = 1000): void {
    const [, force] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
        const t = setInterval(force, ms);
        return () => clearInterval(t);
    }, [ms]);
}
