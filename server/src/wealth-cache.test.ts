import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { invalidateWealthCache, resetWealthCacheForTests, wealthCacheSizeForTests, withWealthCache } from './wealth-cache.js'

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

test('a result computed while a write invalidated the cache is not served as fresh afterwards', async () => {
  let finishCompute: (value: string) => void = () => {}
  const slowCompute = vi.fn(() => new Promise<string>((resolve) => { finishCompute = resolve }))

  const inFlight = withWealthCache('key-1', slowCompute)
  invalidateWealthCache()
  finishCompute('before-write')
  expect(await inFlight).toBe('before-write')

  const fresh = vi.fn().mockResolvedValue('after-write')
  expect(await withWealthCache('key-1', fresh)).toBe('after-write')
  expect(fresh).toHaveBeenCalledTimes(1)
})

test('drops expired and invalidated entries when storing a new one', async () => {
  vi.useFakeTimers()
  await withWealthCache('expired', async () => 1, 1_000)
  await withWealthCache('invalidated', async () => 2)
  invalidateWealthCache()
  vi.advanceTimersByTime(2_000)

  await withWealthCache('fresh', async () => 3)

  expect(wealthCacheSizeForTests()).toBe(1)
})

test('never stores more than 500 entries, evicting the oldest first', async () => {
  for (let index = 0; index < 501; index += 1) await withWealthCache(`key-${index}`, async () => index)

  expect(wealthCacheSizeForTests()).toBe(500)
  const recomputeOldest = vi.fn().mockResolvedValue('recomputed')
  expect(await withWealthCache('key-0', recomputeOldest)).toBe('recomputed')
  const newest = vi.fn()
  expect(await withWealthCache('key-500', newest)).toBe(500)
  expect(newest).not.toHaveBeenCalled()
})
