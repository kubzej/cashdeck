import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim()

export const isNeonAuthConfigured = Boolean(neonAuthUrl)

export const authClient = neonAuthUrl
  ? createAuthClient(neonAuthUrl, {
      adapter: BetterAuthReactAdapter(),
    })
  : null

export type ConfiguredAuthClient = NonNullable<typeof authClient>
