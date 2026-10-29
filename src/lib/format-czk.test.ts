import { expect, test } from 'vitest'
import { formatCzk } from './format-czk'

// Thousands are grouped with a no-break space; the space before "Kč" is a plain one.
test('groups thousands and appends the currency', () => {
  expect(formatCzk(125000)).toBe('125\u00a0000 Kč')
  expect(formatCzk(0)).toBe('0 Kč')
})

test('shows no sign unless asked, and then only for non-zero amounts', () => {
  expect(formatCzk(-5000)).toBe('5\u00a0000 Kč')
  expect(formatCzk(5000, { signed: true })).toBe('+5\u00a0000 Kč')
  expect(formatCzk(-5000, { signed: true })).toBe('-5\u00a0000 Kč')
  expect(formatCzk(0, { signed: true })).toBe('0 Kč')
})
