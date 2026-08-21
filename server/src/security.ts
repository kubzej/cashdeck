import { timingSafeEqual } from 'node:crypto'

/** Constant-time string comparison — avoids leaking secret length/content via response timing. */
export function safeEqual(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
}
