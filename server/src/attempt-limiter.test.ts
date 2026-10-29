import { expect, test } from 'vitest'
import { createAttemptLimiter } from './attempt-limiter.js'

function createClock(start = 1_000_000) {
  let now = start
  return { now: () => now, advance: (ms: number) => { now += ms } }
}

function createLimiter(clock: ReturnType<typeof createClock>) {
  return createAttemptLimiter({
    perClient: { maxFailures: 3, windowMs: 60_000 },
    global: { maxFailures: 5, windowMs: 600_000 },
    now: clock.now,
  })
}

test('allows a client until it reaches the per-client failure limit', () => {
  const clock = createClock()
  const limiter = createLimiter(clock)

  limiter.recordFailure('a')
  limiter.recordFailure('a')
  expect(limiter.retryAfterSeconds('a')).toBeNull()

  limiter.recordFailure('a')
  expect(limiter.retryAfterSeconds('a')).toBe(60)
  expect(limiter.retryAfterSeconds('b')).toBeNull()
})

test('unblocks a client once its window expires', () => {
  const clock = createClock()
  const limiter = createLimiter(clock)

  for (let attempt = 0; attempt < 3; attempt += 1) limiter.recordFailure('a')
  clock.advance(30_000)
  expect(limiter.retryAfterSeconds('a')).toBe(30)

  clock.advance(30_000)
  expect(limiter.retryAfterSeconds('a')).toBeNull()
})

test('blocks every client once the global failure limit is reached', () => {
  const clock = createClock()
  const limiter = createLimiter(clock)

  for (const client of ['a', 'b', 'c', 'd', 'e']) limiter.recordFailure(client)

  expect(limiter.retryAfterSeconds('fresh-client')).toBe(600)
})

test('a success clears only that client’s failures, not the global count', () => {
  const clock = createClock()
  const limiter = createLimiter(clock)

  limiter.recordFailure('a')
  limiter.recordFailure('a')
  limiter.recordSuccess('a')
  limiter.recordFailure('a')
  limiter.recordFailure('a')
  expect(limiter.retryAfterSeconds('a')).toBeNull()

  limiter.recordFailure('b')
  expect(limiter.retryAfterSeconds('c')).toBe(600)
})
