import { getAuthToken } from './auth-client'

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function verifyBackendSession() {
  await apiRequest<void>('/session')
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  if (!apiUrl) {
    throw new Error('Cashdeck API není pro toto prostředí nastavené.')
  }

  const token = await getAuthToken()
  if (!token) {
    throw new Error('Nelze získat přístupový token.')
  }

  const response = await fetch(`${apiUrl}${path}`, {
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
