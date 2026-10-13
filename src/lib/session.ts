// Session cookie names (set by the BFF in src/app/api/[...path]/route.ts). Each FMS app has
// its own prefix: on localhost the apps share cookies across ports.
export const SESSION_PREFIX = 'fms_spv';
export const SESSION = {
    access: `${SESSION_PREFIX}_at`, // httpOnly: access token
    refresh: `${SESSION_PREFIX}_rt`, // httpOnly: refresh token
    flag: `${SESSION_PREFIX}_session`, // readable by the page: "a session exists" (no secret)
} as const;
