import { expect, test } from 'vitest'
import {
  DomainError,
  normalizeCategoryName,
  normalizeLabelName,
  normalizeWalletName,
  parseCalendarDate,
  parseCategoryIconKey,
  parseColorKey,
  parseWalletType,
  parseWholeCzk,
} from './domain.js'

test('normalizes category names and lowercase labels', () => {
  expect(normalizeCategoryName('  restaurace  ')).toBe('Restaurace')
  expect(normalizeCategoryName('úČty')).toBe('ÚČty')
  expect(normalizeLabelName('  FoundationGalaxy  ')).toBe('foundationgalaxy')
})

test('collapses internal whitespace runs so near-duplicate names normalize identically', () => {
  expect(normalizeLabelName('globus  praha')).toBe(normalizeLabelName('globus praha'))
  expect(normalizeLabelName('globus\t\tpraha')).toBe('globus praha')
  expect(normalizeWalletName('Běžný    účet')).toBe('Běžný účet')
  expect(normalizeCategoryName('Vzdělávání   a   kurzy')).toBe('Vzdělávání a kurzy')
})

test('rejects a category name whose first character has no letter case at all', () => {
  expect(() => normalizeCategoryName('1. dar')).toThrow(DomainError)
  expect(() => normalizeCategoryName('42')).toThrow(DomainError)
  expect(() => normalizeCategoryName('  ')).toThrow(DomainError)
})

test('rejects invalid whole-CZK values and calendar dates', () => {
  expect(() => parseWholeCzk(-1, 'Částka', { allowNegative: false })).toThrow(DomainError)
  expect(() => parseWholeCzk(1.5, 'Částka', { allowNegative: true })).toThrow(DomainError)
  expect(() => parseCalendarDate('2026-02-30', 'Datum')).toThrow(DomainError)
})

test('accepts the extended category icon and color catalogs', () => {
  expect(parseCategoryIconKey('chart-no-axes-combined')).toBe('chart-no-axes-combined')
  expect(parseColorKey('brown-dark')).toBe('brown-dark')
})

test('accepts every wallet type and rejects an unsupported one', () => {
  expect(parseWalletType('investment')).toBe('investment')
  expect(parseWalletType('pension')).toBe('pension')
  expect(() => parseWalletType('brokerage')).toThrow(DomainError)
  expect(() => parseWalletType(undefined)).toThrow(DomainError)
})

test('whole-CZK amounts are capped at 10 billion in either direction, so a typo cannot be saved', () => {
  expect(parseWholeCzk(10_000_000_000, 'Částka', { allowNegative: false })).toBe(10_000_000_000)
  expect(parseWholeCzk(-10_000_000_000, 'Počáteční zůstatek', { allowNegative: true })).toBe(-10_000_000_000)
  expect(() => parseWholeCzk(10_000_000_001, 'Částka', { allowNegative: false })).toThrow('Částka je příliš velké číslo.')
  expect(() => parseWholeCzk(-10_000_000_001, 'Počáteční zůstatek', { allowNegative: true })).toThrow(DomainError)
  expect(() => parseWholeCzk(1_500_000_000_000_000, 'Částka', { allowNegative: false })).toThrow(DomainError)
})
