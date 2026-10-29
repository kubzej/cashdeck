import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthSession, type AuthStatus } from './auth-context'
import { ApiError, setUnauthorizedHandler, unlock as requestUnlock, verifyBackendSession } from '../lib/api-client'
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
    // A retry from the error screen should look like loading, not like nothing happened.
    setStatus((current) => (current === 'error' ? 'loading' : current))

    try {
      const result = await verifyBackendSession()
      // Renewed token from the API; an API that predates sliding sessions omits it, and the
      // current token then simply stays in place.
      if (typeof result.token === 'string') setStoredSessionToken(result.token)
      setSession({ userId: result.userId })
      setStatus('signed-in')
    } catch (error) {
      setSession(null)
      if (error instanceof ApiError && error.status === 401) {
        // The API itself says the token is no good.
        clearStoredSessionToken()
        setStatus('signed-out')
        return
      }
      // Offline, a slow signal or a restarting server says nothing about the token: keep it,
      // so reopening the app later doesn't cost a re-unlock.
      // Status 0 is a network failure or timeout, whose message already says what to do.
      setErrorMessage(error instanceof ApiError ? (error.status === 0 ? error.message : 'Server právě neodpovídá. Zkus to za chvíli.') : null)
      setStatus('error')
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

  // A 401 on any request while the app is open (e.g. the signing secret was rotated) returns the
  // user to the passphrase screen instead of leaving every screen stuck on a failing retry.
  useEffect(() => {
    setUnauthorizedHandler(() => { void signOut() })
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  const value = useMemo(
    () => ({ status, session, errorMessage, refreshSession, unlock, signOut }),
    [errorMessage, refreshSession, session, signOut, status, unlock],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
