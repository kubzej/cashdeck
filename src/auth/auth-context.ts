import { createContext, useContext } from 'react'
import type { ConfiguredAuthClient } from '../lib/auth-client'

export type AuthSession = Awaited<ReturnType<ConfiguredAuthClient['getSession']>>['data']
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable' | 'error'

export type AuthContextValue = {
  status: AuthStatus
  session: AuthSession | null
  errorMessage: string | null
  refreshSession: () => Promise<void>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
