import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { invalidateWealthCache, resetWealthCacheForTests, withWealthCache } from './wealth-cache.js'

beforeEach(() => resetWealthCacheForTests())
afterEach(() => vi.useRealTimers())

test('returns the cached value on a second call with the same key, without recomputing', async () => {
  const compute = vi.fn().mockResolvedValue(42)

  const first = await withWealthCache('key-1', compute)
  const second = await withWealthCache('key-1', compute)

  expect(first).toBe(42)
  expect(second).toBe(42)
  expect(compute).toHaveBeenCalledTimes(1)
})

test('recomputes for a different key', async () => {
  const compute = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b')

  const first = await withWealthCache('key-a', compute)
  const second = await withWealthCache('key-b', compute)

  expect(first).toBe('a')
  expect(second).toBe('b')
  expect(compute).toHaveBeenCalledTimes(2)
})

test('invalidateWealthCache forces every key to recompute on its next read', async () => {
  const compute = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')

  await withWealthCache('key-1', compute)
  invalidateWealthCache()
  const afterInvalidate = await withWealthCache('key-1', compute)

  expect(afterInvalidate).toBe('second')
  expect(compute).toHaveBeenCalledTimes(2)
})

test('recomputes once the TTL has elapsed, even without an explicit invalidation', async () => {
  vi.useFakeTimers()
  const compute = vi.fn().mockResolvedValueOnce('fresh').mockResolvedValueOnce('stale-refreshed')

  await withWealthCache('key-1', compute, 1000)
  vi.advanceTimersByTime(1001)
  const afterTtl = await withWealthCache('key-1', compute, 1000)

  expect(afterTtl).toBe('stale-refreshed')
  expect(compute).toHaveBeenCalledTimes(2)
})
