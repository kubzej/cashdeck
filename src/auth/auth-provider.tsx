import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthSession, type AuthStatus } from './auth-context'
import { authClient, isNeonAuthConfigured } from '../lib/auth-client'

type AuthErrorResponse = { code?: string; message?: string }

function getAuthErrorMessage(error: unknown) {
  const authError = error as AuthErrorResponse | null

  switch (authError?.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'USER_NOT_FOUND':
    case 'invalid_credentials':
      return 'Email nebo heslo není správně.'
    case 'TOO_MANY_REQUESTS':
      return 'Příliš mnoho pokusů. Zkus to za chvíli znovu.'
    case 'USER_ALREADY_EXISTS':
      return 'Účet s tímto emailem už existuje.'
    default:
      return 'Přihlášení se nepodařilo. Zkus to znovu.'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isNeonAuthConfigured ? 'loading' : 'unavailable')
  const [session, setSession] = useState<AuthSession>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshSession = useCallback(async () => {
    const client = authClient
    if (!client) {
      setStatus('unavailable')
      setSession(null)
      return
    }

    setErrorMessage(null)

    try {
      const response = await client.getSession()
      if (response.error) {
        setStatus('error')
        setSession(null)
        setErrorMessage(getAuthErrorMessage(response.error))
        return
      }

      const nextSession = response.data?.user ? response.data : null
      setSession(nextSession)
      setStatus(nextSession ? 'signed-in' : 'signed-out')
    } catch {
      setStatus('error')
      setSession(null)
      setErrorMessage('Připojení k účtu se nepodařilo. Zkontroluj připojení a zkus to znovu.')
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const signIn = useCallback(async (email: string, password: string) => {
    const client = authClient
    if (!client) return 'Neon Auth není pro toto prostředí nastavený.'

    try {
      const response = await client.signIn.email({ email, password })
      if (response.error) {
        const message = getAuthErrorMessage(response.error)
        setStatus('signed-out')
        setErrorMessage(message)
        return message
      }

      await refreshSession()
      return null
    } catch (error) {
      const message = getAuthErrorMessage(error)
      setStatus('signed-out')
      setErrorMessage(message)
      return message
    }
  }, [refreshSession])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const client = authClient
    if (!client) return 'Neon Auth není pro toto prostředí nastavený.'

    try {
      const response = await client.signUp.email({ name, email, password })
      if (response.error) {
        const message = getAuthErrorMessage(response.error)
        setStatus('signed-out')
        setErrorMessage(message)
        return message
      }

      await refreshSession()
      return null
    } catch (error) {
      const message = getAuthErrorMessage(error)
      setStatus('signed-out')
      setErrorMessage(message)
      return message
    }
  }, [refreshSession])

  const signOut = useCallback(async () => {
    const client = authClient
    if (client) await client.signOut()
    setSession(null)
    setStatus('signed-out')
    setErrorMessage(null)
  }, [])

  const value = useMemo(
    () => ({ status, session, errorMessage, refreshSession, signIn, signUp, signOut }),
    [errorMessage, refreshSession, session, signIn, signOut, signUp, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
