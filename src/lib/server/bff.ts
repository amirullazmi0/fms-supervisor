// BFF (backend for frontend): the browser only talks to this app's /api. Tokens live in
// httpOnly cookies on this domain and never reach page JavaScript; the BFF adds the Bearer
// header, renews the session on a 401 (refresh token) and streams the response back (SSE too).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION } from '@/lib/session';

// fms-supervisor: every role may sign in; pages are gated by permissions.
const REQUIRE_ADMIN_APP = false;
const NOT_ADMIN = '';

// Backend API, read at runtime (server only, not baked into the build).
const API_URL = (process.env.API_URL ?? 'http://localhost:3100/api').replace(/\/$/, '');
const REFRESH_MAX_AGE = 7 * 24 * 3600; // same as the backend refresh token
const IS_DEV = process.env.NODE_ENV === 'development';

interface Tokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

interface Envelope<T = unknown> {
    success?: boolean;
    message?: string;
    data?: T;
    [key: string]: unknown;
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const fail = (message: string, status: number) => json({ success: false, message }, status);

function publicOrigin(req: NextRequest): { origin: string; https: boolean } {
    const proto =
        req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
        req.nextUrl.protocol.replace(':', '');
    const host =
        req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
        req.headers.get('host') ||
        req.nextUrl.host;
    return { origin: `${proto}://${host}`, https: proto === 'https' };
}

// Writes from another site are refused (the session cookies would ride along).
function originError(req: NextRequest): NextResponse | null {
    if (req.method === 'GET' || req.method === 'HEAD' || IS_DEV) return null;
    const origin = req.headers.get('origin');
    if (origin && origin !== publicOrigin(req).origin) return fail('Origin tidak diizinkan', 403);
    return null;
}

function setSession(res: NextResponse, req: NextRequest, t: Tokens) {
    const base = { path: '/', sameSite: 'lax' as const, secure: publicOrigin(req).https };
    res.cookies.set(SESSION.access, t.access_token, {
        ...base,
        httpOnly: true,
        maxAge: Math.max(60, t.expires_in),
    });
    res.cookies.set(SESSION.refresh, t.refresh_token, {
        ...base,
        httpOnly: true,
        maxAge: REFRESH_MAX_AGE,
    });
    res.cookies.set(SESSION.flag, '1', { ...base, httpOnly: false, maxAge: REFRESH_MAX_AGE });
}

function clearSession(res: NextResponse) {
    for (const name of [SESSION.access, SESSION.refresh, SESSION.flag])
        res.cookies.set(name, '', { path: '/', maxAge: 0 });
}

function upstreamHeaders(req: NextRequest, accessToken?: string): Headers {
    const h = new Headers();
    for (const name of ['content-type', 'accept', 'accept-language', 'user-agent']) {
        const v = req.headers.get(name);
        if (v) h.set(name, v);
    }
    // Client IP for the backend (rate limits, logs).
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
    if (ip) h.set('x-forwarded-for', ip);
    if (accessToken) h.set('authorization', `Bearer ${accessToken}`);
    return h;
}

async function readJson<T>(res: Response): Promise<Envelope<T>> {
    const text = await res.text();
    try {
        return JSON.parse(text) as Envelope<T>;
    } catch {
        return {
            success: false,
            message: IS_DEV ? text.slice(0, 500) : 'Respons server tidak valid',
        };
    }
}

const unreachable = () => fail('Server FMS tidak dapat dihubungi', 502);

// ---------- refresh (one at a time per refresh token: the backend rotates it) ----------
const inflight = new Map<string, { at: number; promise: Promise<Tokens | null> }>();

function refresh(refreshToken: string): Promise<Tokens | null> {
    const now = Date.now();
    for (const [k, v] of inflight) if (now - v.at > 30_000) inflight.delete(k);
    const hit = inflight.get(refreshToken);
    if (hit) return hit.promise; // parallel requests (and ones that still carry the old cookie) share the result
    const promise = (async () => {
        try {
            const res = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
                cache: 'no-store',
            });
            const body = await readJson<Tokens>(res);
            return res.ok && body.data?.access_token ? body.data : null;
        } catch {
            return null;
        }
    })();
    inflight.set(refreshToken, { at: now, promise });
    return promise;
}

// ---------- auth ----------
async function login(req: NextRequest) {
    let upstream: Response;
    try {
        upstream = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: upstreamHeaders(req),
            body: await req.text(),
            cache: 'no-store',
        });
    } catch {
        return unreachable();
    }
    const body = await readJson<Tokens & { user: { admin_app?: boolean } }>(upstream);
    if (!upstream.ok || !body.data?.access_token)
        return json(
            { success: false, message: body.message ?? 'Login gagal', errors: body.errors },
            upstream.status || 400,
        );
    const { user, expires_in, access_token } = body.data;
    if (REQUIRE_ADMIN_APP && !user?.admin_app) {
        // Not allowed in here: end the backend session again and set no cookie.
        void fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: upstreamHeaders(req, access_token),
            cache: 'no-store',
        }).catch(() => {});
        return fail(NOT_ADMIN, 403);
    }
    const res = json({
        success: true,
        message: body.message ?? 'Login berhasil',
        data: { user, expires_in },
    });
    setSession(res, req, body.data);
    return res;
}

async function logout(req: NextRequest) {
    let token = req.cookies.get(SESSION.access)?.value;
    const rt = req.cookies.get(SESSION.refresh)?.value;
    if (!token && rt) token = (await refresh(rt))?.access_token;
    if (token) {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: upstreamHeaders(req, token),
            cache: 'no-store',
        }).catch(() => {});
    }
    const res = json({ success: true, message: 'Logout berhasil' });
    clearSession(res);
    return res;
}

async function renew(req: NextRequest) {
    const rt = req.cookies.get(SESSION.refresh)?.value;
    const t = rt ? await refresh(rt) : null;
    if (!t) {
        const res = fail('Sesi berakhir, silakan login kembali', 401);
        clearSession(res);
        return res;
    }
    const res = json({
        success: true,
        message: 'Sesi diperpanjang',
        data: { expires_in: t.expires_in },
    });
    setSession(res, req, t);
    return res;
}

// ---------- everything else: forwarded as is ----------
const DROP_RESPONSE_HEADERS = new Set([
    'set-cookie',
    'content-length',
    'content-encoding',
    'transfer-encoding',
    'connection',
    'keep-alive',
]);

async function forward(req: NextRequest, path: string) {
    const target = `${API_URL}/${path}${req.nextUrl.search}`;
    const body =
        req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
    let token = req.cookies.get(SESSION.access)?.value;
    const rt = req.cookies.get(SESSION.refresh)?.value;
    let renewed: Tokens | null = null;
    let tried = false;
    if (!token && rt) {
        tried = true;
        renewed = await refresh(rt);
        token = renewed?.access_token;
    }
    // req.signal: the browser leaving (e.g. the SSE stream) also closes the backend request.
    const send = (t?: string) =>
        fetch(target, {
            method: req.method,
            headers: upstreamHeaders(req, t),
            body,
            cache: 'no-store',
            redirect: 'manual',
            signal: req.signal,
        });

    let upstream: Response;
    try {
        upstream = await send(token);
        if (upstream.status === 401 && rt && !tried) {
            tried = true;
            renewed = await refresh(rt);
            if (renewed) upstream = await send(renewed.access_token);
        }
    } catch {
        return unreachable();
    }

    const headers = new Headers();
    upstream.headers.forEach((v, k) => {
        if (!DROP_RESPONSE_HEADERS.has(k.toLowerCase())) headers.set(k, v);
    });
    const res = new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
    });
    if (renewed) setSession(res, req, renewed);
    else if (upstream.status === 401 && (token || rt)) clearSession(res); // session can't be renewed: sign in again
    return res;
}

export async function handleBff(req: NextRequest, segments: string[]) {
    const blocked = originError(req);
    if (blocked) return blocked;
    const path = segments.map(encodeURIComponent).join('/');
    if (req.method === 'POST' && path === 'auth/login') return login(req);
    if (req.method === 'POST' && path === 'auth/logout') return logout(req);
    if (req.method === 'POST' && path === 'auth/refresh') return renew(req);
    return forward(req, path);
}
