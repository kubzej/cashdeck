const DEFAULT_TTL_MS = 30_000
// Keys include arbitrary date ranges and wallet selections, so the map needs a hard ceiling.
const MAX_ENTRIES = 500

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
 * Call it only after the write has committed: invalidating inside an open transaction lets a
 * concurrent read cache the pre-commit state under the new generation.
 */
export function invalidateWealthCache() {
  generation += 1
}

export async function withWealthCache<T>(key: string, compute: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const cached = store.get(key)
  const now = Date.now()
  if (cached && cached.generation === generation && cached.expiresAt > now) return cached.value as T

  // Captured before computing: a write that invalidates mid-compute must leave this (possibly
  // stale) result tagged with the old generation so the next read recomputes it.
  const computedAtGeneration = generation
  const value = await compute()
  store.delete(key)
  pruneExpired(Date.now())
  // Map iteration follows insertion order, so the first key is the least recently stored one.
  while (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!)
  store.set(key, { value, generation: computedAtGeneration, expiresAt: now + ttlMs })
  return value
}

function pruneExpired(now: number) {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now || entry.generation !== generation) store.delete(key)
  }
}

/** Test-only: number of stored entries, to verify eviction. */
export function wealthCacheSizeForTests() {
  return store.size
}

/** Test-only: clears cached entries so repository tests don't leak state across cases. */
export function resetWealthCacheForTests() {
  store.clear()
  generation = 0
}
