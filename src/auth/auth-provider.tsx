import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthSession, type AuthStatus } from './auth-context'
import { ApiError, unlock as requestUnlock, verifyBackendSession } from '../lib/api-client'
import { clearStoredSessionToken, getStoredSessionToken, setStoredSessionToken } from '../lib/session-token'

const isApiConfigured = Boolean(import.meta.env.VITE_API_URL?.trim())

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isApiConfigured ? 'loading' : 'unavailable')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshSession = useCallback(async () => {
    if (!isApiConfigured) {
      setStatus('unavailable')
      setSession(null)
      return
    }

    if (!(await getStoredSessionToken())) {
      setSession(null)
      setStatus('signed-out')
      return
    }

    setErrorMessage(null)

    try {
      const result = await verifyBackendSession()
      setSession({ userId: result.userId })
      setStatus('signed-in')
    } catch {
      clearStoredSessionToken()
      setSession(null)
      setStatus('signed-out')
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const unlock = useCallback(async (passphrase: string) => {
    try {
      const token = await requestUnlock(passphrase)
      setStoredSessionToken(token)
      await refreshSession()
      return null
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Odemčení se nepodařilo. Zkus to znovu.'
      setStatus('signed-out')
      setErrorMessage(message)
      return message
    }
  }, [refreshSession])

  const signOut = useCallback(async () => {
    clearStoredSessionToken()
    setSession(null)
    setStatus('signed-out')
    setErrorMessage(null)
  }, [])

  const value = useMemo(
    () => ({ status, session, errorMessage, refreshSession, unlock, signOut }),
    [errorMessage, refreshSession, session, signOut, status, unlock],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
