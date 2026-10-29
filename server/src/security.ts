import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison. Both inputs are hashed first so the compared buffers always
 * have the same length — comparing raw buffers would return early on a length mismatch and leak
 * the secret's length through response timing.
 */
export function safeEqual(expected: string, provided: string) {
  const expectedDigest = createHash('sha256').update(expected).digest()
  const providedDigest = createHash('sha256').update(provided).digest()
  return timingSafeEqual(expectedDigest, providedDigest)
}
