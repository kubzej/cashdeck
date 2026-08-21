const DEFAULT_TTL_MS = 30_000

type CacheEntry = { value: unknown; generation: number; expiresAt: number }

let generation = 0
const store = new Map<string, CacheEntry>()

/**
 * Overview/Independence wealth queries scan the user's entire financial history (see
 * financialEvents() in overview/repository.ts and independence/repository.ts) — there's no
 * running-balance snapshot. Every write that can change a wealth total must call this so a
 * cached result never outlives the data it was computed from. The generation counter (not a
 * per-key delete) is deliberate: a write can affect wealth for ANY date range/wallet
 * combination, so partial invalidation would just be guessing which cache keys are affected.
 */
export function invalidateWealthCache() {
  generation += 1
}

export async function withWealthCache<T>(key: string, compute: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const cached = store.get(key)
  const now = Date.now()
  if (cached && cached.generation === generation && cached.expiresAt > now) return cached.value as T

  const value = await compute()
  store.set(key, { value, generation, expiresAt: now + ttlMs })
  return value
}

/** Test-only: clears cached entries so repository tests don't leak state across cases. */
export function resetWealthCacheForTests() {
  store.clear()
  generation = 0
}
