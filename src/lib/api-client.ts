import { getStoredSessionToken } from './session-token'

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const pendingGetRequests = new Map<string, Promise<unknown>>()

let unauthorizedHandler: (() => void) | null = null

/** AuthProvider registers how the app reacts when the API rejects the session token mid-use. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

const NETWORK_ERROR_MESSAGE = 'Nelze se spojit se serverem. Zkontroluj připojení a zkus to znovu.'
const READ_TIMEOUT_MESSAGE = 'Server neodpověděl včas. Zkus to znovu.'
// A write that times out on the client may still have been saved by the server, so retrying
// blindly could create a duplicate.
const WRITE_TIMEOUT_MESSAGE = 'Server neodpověděl včas. Zkontroluj, jestli se záznam uložil, než to zkusíš znovu.'
const UNEXPECTED_RESPONSE_MESSAGE = 'Server vrátil neočekávanou odpověď.'
const READ_TIMEOUT_MS = 30_000
const WRITE_TIMEOUT_MS = 60_000

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** True for the error `fetch` rejects with when its request was cancelled through an AbortSignal. */
export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function verifyBackendSession() {
  return apiRequest<{ userId: string; token?: string }>('/session')
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

  return withDeadline(undefined, 'read', async (signal) => {
    const response = await fetch(`${apiUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
      signal,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: unknown } | null
      const message = typeof payload?.error === 'string' ? payload.error : 'Odemčení se nepodařilo.'
      throw new ApiError(response.status, message)
    }

    const payload = await response.json().catch(() => null) as { token?: unknown } | null
    if (typeof payload?.token !== 'string' || !payload.token) throw new ApiError(response.status, 'Odemčení se nepodařilo. Zkus to znovu.')
    return payload.token
  })
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
  const isWrite = (init.method ?? 'GET').toUpperCase() !== 'GET'
  return withDeadline(init.signal, isWrite ? 'write' : 'read', async (signal) => {
    const response = await fetch(url, {
      ...init,
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    return readResponse<T>(response, token)
  })
}

async function readResponse<T>(response: Response, token: string) {
  if (!response.ok) {
    // Only react if the rejected token is still the current one: a slow request sent before the
    // user unlocked again must not sign out the fresh session.
    if (response.status === 401 && (await getStoredSessionToken()) === token) unauthorizedHandler?.()

    const payload = await response.json().catch(() => null) as { error?: unknown; message?: unknown } | null
    const message = typeof payload?.message === 'string'
      ? payload.message
      : typeof payload?.error === 'string'
        ? payload.error
        : 'Požadavek se nepodařilo dokončit.'

    throw new ApiError(response.status, message)
  }

  if (response.status === 204) return undefined as T

  return response.json().catch((error: unknown) => {
    // A body that isn't JSON (e.g. an HTML page from a proxy) is a bad response, not a crash.
    if (error instanceof SyntaxError) throw new ApiError(response.status, UNEXPECTED_RESPONSE_MESSAGE)
    throw error
  }) as Promise<T>
}

/**
 * Bounds a request (headers and body) with a timeout and turns low-level failures into Czech
 * `ApiError`s with status 0. A caller-initiated abort is passed through untouched: screens rely
 * on seeing an `AbortError` to ignore responses to requests they replaced.
 */
async function withDeadline<T>(callerSignal: AbortSignal | null | undefined, kind: 'read' | 'write', run: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, kind === 'write' ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS)

  try {
    return await run(controller.signal)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (callerSignal?.aborted) throw error
    if (timedOut) throw new ApiError(0, kind === 'write' ? WRITE_TIMEOUT_MESSAGE : READ_TIMEOUT_MESSAGE)
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}
