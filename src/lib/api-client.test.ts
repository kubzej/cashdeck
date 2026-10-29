import { afterEach, beforeEach, expect, test, vi } from 'vitest'

let storedToken: string | null

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'http://api.test/api')
  storedToken = 'token-a'
  vi.stubGlobal('localStorage', {
    getItem: () => storedToken,
    setItem: (_key: string, value: string) => { storedToken = value },
    removeItem: () => { storedToken = null },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function jsonResponse(status: number) {
  return new Response(JSON.stringify({ error: 'Chyba' }), { status, headers: { 'content-type': 'application/json' } })
}

test('a 401 for the current session token tells the app to sign out', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401)))
  const { apiRequest, setUnauthorizedHandler } = await import('./api-client')
  const onUnauthorized = vi.fn()
  setUnauthorizedHandler(onUnauthorized)

  await expect(apiRequest('/feed')).rejects.toMatchObject({ status: 401 })

  expect(onUnauthorized).toHaveBeenCalledTimes(1)
})

test('a late 401 for a token that has been replaced since does not sign out the new session', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => {
    storedToken = 'token-b'
    return jsonResponse(401)
  }))
  const { apiRequest, setUnauthorizedHandler } = await import('./api-client')
  const onUnauthorized = vi.fn()
  setUnauthorizedHandler(onUnauthorized)

  await expect(apiRequest('/feed')).rejects.toMatchObject({ status: 401 })

  expect(onUnauthorized).not.toHaveBeenCalled()
})

test('other failures do not sign the user out', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500)))
  const { apiRequest, setUnauthorizedHandler } = await import('./api-client')
  const onUnauthorized = vi.fn()
  setUnauthorizedHandler(onUnauthorized)

  await expect(apiRequest('/feed')).rejects.toMatchObject({ status: 500 })

  expect(onUnauthorized).not.toHaveBeenCalled()
})

test('without a registered handler a 401 is still just an error for the caller', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401)))
  const { apiRequest, setUnauthorizedHandler } = await import('./api-client')
  setUnauthorizedHandler(null)

  await expect(apiRequest('/feed')).rejects.toMatchObject({ status: 401 })
})

// A fetch that never answers on its own and rejects when its signal is aborted, like the real one.
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError')))
  }))
}

test('a network failure becomes a Czech error instead of the browser\'s English text', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Load failed') }))
  const { apiRequest } = await import('./api-client')

  await expect(apiRequest('/feed')).rejects.toMatchObject({ status: 0, message: 'Nelze se spojit se serverem. Zkontroluj připojení a zkus to znovu.' })
})

test('a read that gets no answer fails after 30 seconds with a retry hint', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', hangingFetch())
  const { apiRequest } = await import('./api-client')

  const request = apiRequest('/feed')
  const outcome = expect(request).rejects.toMatchObject({ status: 0, message: 'Server neodpověděl včas. Zkus to znovu.' })
  await vi.advanceTimersByTimeAsync(29_999)
  expect(vi.getTimerCount()).toBe(1)
  await vi.advanceTimersByTimeAsync(1)
  await outcome
  vi.useRealTimers()
})

test('a write waits 60 seconds and then warns that it may have been saved', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', hangingFetch())
  const { apiRequest } = await import('./api-client')

  const request = apiRequest('/transactions', { method: 'POST', body: '{}' })
  const outcome = expect(request).rejects.toMatchObject({ status: 0, message: 'Server neodpověděl včas. Zkontroluj, jestli se záznam uložil, než to zkusíš znovu.' })
  await vi.advanceTimersByTimeAsync(30_000)
  expect(vi.getTimerCount()).toBe(1)
  await vi.advanceTimersByTimeAsync(30_000)
  await outcome
  vi.useRealTimers()
})

test('a request the screen cancelled itself still fails as an AbortError, not as an ApiError', async () => {
  vi.stubGlobal('fetch', hangingFetch())
  const { apiRequest, ApiError } = await import('./api-client')
  const controller = new AbortController()

  const request = apiRequest('/feed', { signal: controller.signal })
  await Promise.resolve()
  controller.abort()

  const error = await request.catch((caught: unknown) => caught)
  expect(error).not.toBeInstanceOf(ApiError)
  expect(error).toBeInstanceOf(DOMException)
  expect((error as DOMException).name).toBe('AbortError')
})

test('a successful response that is not JSON becomes a readable error', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 200, headers: { 'content-type': 'text/html' } })))
  const { apiRequest } = await import('./api-client')

  await expect(apiRequest('/feed')).rejects.toMatchObject({ status: 200, message: 'Server vrátil neočekávanou odpověď.' })
})

test('unlock returns the token, and refuses a response without a usable one', async () => {
  const { unlock } = await import('./api-client')

  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: 'abc.def' }), { status: 200 })))
  await expect(unlock('heslo')).resolves.toBe('abc.def')

  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
  await expect(unlock('heslo')).rejects.toMatchObject({ message: 'Odemčení se nepodařilo. Zkus to znovu.' })

  vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 200 })))
  await expect(unlock('heslo')).rejects.toMatchObject({ message: 'Odemčení se nepodařilo. Zkus to znovu.' })

  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
  await expect(unlock('heslo')).rejects.toMatchObject({ status: 0 })
})
