import { expect, test } from 'vitest'
import { formatCompactMoney, formatCount, formatItemCount, formatLongDate, formatPercent, formatTransactionCount, formatYears, pluralCs } from './format'

// Intl uses non-breaking spaces; compare with plain ones.
const plain = (text: string) => text.replace(/\s/g, ' ')

test('percentages use the Czech decimal comma and the requested number of decimals', () => {
  expect(plain(formatPercent(12.34))).toBe('12,3 %')
  expect(plain(formatPercent(12.34, 0))).toBe('12 %')
  expect(plain(formatPercent(0))).toBe('0 %')
})

test('compact money keeps one decimal and the currency', () => {
  expect(plain(formatCompactMoney(1_250_000))).toBe('1,3 mil. Kč')
  expect(plain(formatCompactMoney(0))).toBe('0 Kč')
})

test('a long date spells out the month in Czech', () => {
  expect(plain(formatLongDate('2026-10-27'))).toBe('27. října 2026')
  expect(plain(formatLongDate('2026-08-01T10:00:00+02:00'))).toBe('1. srpna 2026')
})

test('the noun form follows the Czech rule for one, two to four, and the rest', () => {
  const form = (count: number) => pluralCs(count, 'rok', 'roky', 'let')
  expect(form(1)).toBe('rok')
  expect([2, 3, 4].map(form)).toEqual(['roky', 'roky', 'roky'])
  // From five up the genitive plural governs every number, including 11, 22 and 100.
  expect([0, 5, 11, 22, 100].map(form)).toEqual(['let', 'let', 'let', 'let', 'let'])
})

test('counts of items and transactions agree with their noun', () => {
  expect(formatItemCount(1)).toBe('1 položka')
  expect(formatItemCount(3)).toBe('3 položky')
  expect(formatItemCount(7)).toBe('7 položek')
  expect(formatItemCount(0)).toBe('0 položek')
  expect(formatTransactionCount(1)).toBe('1 transakce')
  expect(formatTransactionCount(2)).toBe('2 transakce')
  expect(formatTransactionCount(5)).toBe('5 transakcí')
  expect(formatCount(5, 'peněženka', 'peněženky', 'peněženek')).toBe('5 peněženek')
})

test('years are shown in months below one year, in whole years with the right noun, and as a genitive fraction', () => {
  expect(formatYears(1 / 12)).toBe('1 měsíc')
  expect(formatYears(3 / 12)).toBe('3 měsíce')
  expect(formatYears(7 / 12)).toBe('7 měsíců')
  expect(formatYears(1)).toBe('1 rok')
  expect(formatYears(3)).toBe('3 roky')
  expect(formatYears(8)).toBe('8 let')
  expect(formatYears(2.5)).toBe('2,5 roku')
  expect(formatYears(12.04)).toBe('12 let')
})

