const STORAGE_KEY = 'cashdeck-session-token'

/**
 * First-party localStorage instead of Neon Auth's cross-origin session cookie — the cookie
 * doesn't survive in an installed iOS PWA's isolated storage. See the comment on
 * `createLocalAuthGuard` in `server/src/auth.ts` — https://github.com/neondatabase/neon/issues/12934.
 */
/**
 * Async even though localStorage reads are synchronous — `apiRequest` awaits this before
 * dispatching `fetch`, and that yield gives an in-flight request's AbortController (from a
 * React Strict Mode double-effect) time to cancel it before it reaches the network, avoiding a
 * duplicate request to the backend.
 */
export async function getStoredSessionToken() {
  return localStorage.getItem(STORAGE_KEY)
}

export function setStoredSessionToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearStoredSessionToken() {
  localStorage.removeItem(STORAGE_KEY)
}
