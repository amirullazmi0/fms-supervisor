import type { NextRequest } from 'next/server';
import { handleBff } from '@/lib/server/bff';

// BFF: every /api/* call of this app goes to the FMS backend through here (see lib/server/bff.ts).
// Always dynamic (reads cookies and the request); Node runtime is the default.
type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return handleBff(req, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
