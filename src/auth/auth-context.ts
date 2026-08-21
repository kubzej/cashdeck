import { createContext, useContext } from 'react'

export type AuthSession = { userId: string }
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable' | 'error'

export type AuthContextValue = {
  status: AuthStatus
  session: AuthSession | null
  errorMessage: string | null
  refreshSession: () => Promise<void>
  unlock: (passphrase: string) => Promise<string | null>
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
