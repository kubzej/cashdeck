import { expect, test } from 'vitest'
import { safeEqual } from './security.js'

test('safeEqual matches only identical strings, regardless of length', () => {
  expect(safeEqual('correct horse', 'correct horse')).toBe(true)
  expect(safeEqual('correct horse', 'correct hors')).toBe(false)
  expect(safeEqual('correct horse', 'correct horse battery')).toBe(false)
  expect(safeEqual('correct horse', '')).toBe(false)
})
