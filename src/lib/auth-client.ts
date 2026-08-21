/**
 * Neon Auth client, kept but unused as of 2026-08-21 — its session cookie doesn't survive in
 * an installed iOS PWA (standalone display mode), so the app now uses a self-issued passphrase
 * token instead (`src/lib/session-token.ts`, `src/auth/auth-provider.tsx`). Kept in case
 * https://github.com/neondatabase/neon/issues/12934 gets fixed and it's worth switching back.
 */
import { createInternalNeonAuth } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim()

export const isNeonAuthConfigured = Boolean(neonAuthUrl)

const neonAuth = neonAuthUrl
  ? createInternalNeonAuth(neonAuthUrl, {
      adapter: BetterAuthReactAdapter(),
    })
  : null

export const authClient = neonAuth?.adapter ?? null

export async function getAuthToken() {
  return neonAuth?.getJWTToken() ?? null
}

export type ConfiguredAuthClient = NonNullable<typeof authClient>
