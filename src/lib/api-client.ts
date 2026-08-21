import { getStoredSessionToken } from './session-token'

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const pendingGetRequests = new Map<string, Promise<unknown>>()

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function verifyBackendSession() {
  return apiRequest<{ userId: string }>('/session')
}

/**
 * Passphrase-based unlock, replacing Neon Auth's email/password sign-in — see the comment on
 * `createLocalAuthGuard` in `server/src/auth.ts` for why. Bypasses `apiRequest` since there's
 * no session token yet at this point.
 */
export async function unlock(passphrase: string) {
  if (!apiUrl) {
    throw new Error('Cashdeck API není pro toto prostředí nastavené.')
  }

  const response = await fetch(`${apiUrl}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: unknown } | null
    const message = typeof payload?.error === 'string' ? payload.error : 'Odemčení se nepodařilo.'
    throw new ApiError(response.status, message)
  }

  const { token } = await response.json() as { token: string }
  return token
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  if (!apiUrl) {
    throw new Error('Cashdeck API není pro toto prostředí nastavené.')
  }

  const token = await getStoredSessionToken()
  if (!token) {
    throw new Error('Nelze získat přístupový token.')
  }

  if ((init.method ?? 'GET').toUpperCase() !== 'GET' || init.body || init.signal) return sendRequest<T>(`${apiUrl}${path}`, token, init)

  const requestKey = `${token}:${path}`
  const pendingRequest = pendingGetRequests.get(requestKey) as Promise<T> | undefined
  if (pendingRequest) return pendingRequest

  const request = sendRequest<T>(`${apiUrl}${path}`, token, init)
  pendingGetRequests.set(requestKey, request)
  try {
    return await request
  } finally {
    pendingGetRequests.delete(requestKey)
  }
}

async function sendRequest<T>(url: string, token: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: unknown; message?: unknown } | null
    const message = typeof payload?.message === 'string'
      ? payload.message
      : typeof payload?.error === 'string'
        ? payload.error
        : 'Požadavek se nepodařilo dokončit.'

    throw new ApiError(response.status, message)
  }

  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}
