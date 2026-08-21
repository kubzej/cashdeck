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
