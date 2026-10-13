import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION } from '@/lib/session';

// Route protection (Next 16 `proxy`, formerly `middleware`). Pages need a session
// (access or refresh cookie: an expired access token is renewed by the BFF).
// What a user may do inside is decided by permissions, checked in the UI and by the API.
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hasSession = Boolean(
        request.cookies.get(SESSION.access)?.value || request.cookies.get(SESSION.refresh)?.value,
    );

    if (pathname.startsWith('/auth')) {
        if (hasSession) return NextResponse.redirect(new URL('/', request.url));
        return NextResponse.next();
    }

    if (!hasSession) {
        const loginUrl = new URL('/auth/sign-in', request.url);
        if (pathname !== '/') loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api/|_next/static|_next/image|favicon.ico|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
