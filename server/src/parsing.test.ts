import { expect, test } from 'vitest'
import { escapeLikePattern, parseLabelIds, parseLabels, parseLimit, parseOptionalNote, parsePositiveAmount, parseSearch, parseWalletIds } from './parsing.js'
import { parseRecurringRule } from './recurring/domain.js'

const uuidA = 'c00f7a6a-d0c1-4f08-9bd4-643415bef126'
const uuidB = 'a4c9592c-4bd6-4123-9397-a4c9592c4bd6'

test('wallet ids: comma-separated UUIDs, at most 50, no duplicates', () => {
  expect(parseWalletIds(`${uuidA},${uuidB}`)).toEqual([uuidA, uuidB])
  expect(() => parseWalletIds(`${uuidA},${uuidA}`)).toThrow('Výběr peněženek obsahuje duplicitu.')
  expect(() => parseWalletIds('')).toThrow('Výběr peněženek není platný.')
  expect(() => parseWalletIds(Array.from({ length: 51 }, () => uuidA).join(','))).toThrow('Výběr peněženek není platný.')
})

test('search: trimmed, blank means no search, at most 100 characters', () => {
  expect(parseSearch('  Oneplay ')).toBe('Oneplay')
  expect(parseSearch('   ')).toBeNull()
  expect(() => parseSearch('x'.repeat(101))).toThrow('Hledání může mít nejvýše 100 znaků.')
})

test('limit: a whole number between 1 and 100', () => {
  expect(parseLimit('25')).toBe(25)
  expect(() => parseLimit('0')).toThrow('Parametr limit musí být mezi 1 a 100.')
  expect(() => parseLimit('101')).toThrow('Parametr limit musí být mezi 1 a 100.')
  expect(() => parseLimit('2.5')).toThrow('Parametr limit není platný.')
})

test('amount: a positive whole number of crowns', () => {
  expect(parsePositiveAmount(1)).toBe(1)
  expect(() => parsePositiveAmount(0)).toThrow('Částka musí být alespoň 1 Kč.')
  expect(() => parsePositiveAmount(-5)).toThrow()
})

test('note: trimmed, empty means none, at most 2000 characters', () => {
  expect(parseOptionalNote('  Přesun ')).toBe('Přesun')
  expect(parseOptionalNote('  ')).toBeNull()
  expect(parseOptionalNote(undefined)).toBeNull()
  expect(() => parseOptionalNote('x'.repeat(2001))).toThrow('Poznámka může mít nejvýše 2000 znaků.')
})

test('label ids are strict: they must be a list of unique UUIDs, and a missing value is rejected', () => {
  expect(parseLabelIds([uuidA, uuidB])).toEqual([uuidA, uuidB])
  expect(() => parseLabelIds([uuidA, uuidA])).toThrow('Štítky se nesmí opakovat.')
  expect(() => parseLabelIds(undefined)).toThrow('Štítky musí být seznam ID.')
})

test('a recurring rule without labelIds has no labels, while the shared parser stays strict', () => {
  const rule = parseRecurringRule({ name: 'Nájem', kind: 'transaction', amountCzk: 15000, walletId: uuidA, categoryId: uuidB, note: null, frequency: 'monthly', nextOccurrenceDate: '2099-01-01' })
  expect(rule.labelIds).toEqual([])
})

test('label rows: JSON string or array accepted, malformed entries dropped', () => {
  expect(parseLabels('[{"id":"1","name":"a"},{"id":2},null]')).toEqual([{ id: '1', name: 'a' }])
  expect(parseLabels(null)).toEqual([])
})

test('LIKE escaping makes %, _ and backslash literal', () => {
  expect(escapeLikePattern('50% sleva_')).toBe('50\\% sleva\\_')
  expect(escapeLikePattern('a\\b')).toBe('a\\\\b')
  expect(escapeLikePattern('Oneplay')).toBe('Oneplay')
})
