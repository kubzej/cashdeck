import { expect, test } from 'vitest'
import {
  defaultCategories,
  defaultCategorySeeds,
  DomainError,
  normalizeCategoryName,
  normalizeLabelName,
  normalizeWalletName,
  parseCalendarDate,
  parseCategoryIconKey,
  parseColorKey,
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

test('defines the agreed one-time default category set', () => {
  expect(defaultCategories).toHaveLength(29)
  expect(defaultCategories.filter((category) => category.direction === 'expense')).toHaveLength(22)
  expect(defaultCategories.filter((category) => category.direction === 'income')).toHaveLength(7)
  expect(defaultCategories.some((category) => category.name === 'Měsíční změny')).toBe(false)
})

test('allows the same visible name to exist once per direction, e.g. Dar as both an expense and an income category', () => {
  const darCategories = defaultCategories.filter((category) => category.name === 'Dar')
  expect(darCategories).toHaveLength(2)
  expect(darCategories.map((category) => category.direction).sort()).toEqual(['expense', 'income'])
  const seeds = defaultCategorySeeds()
  const seededDarKeys = seeds.filter((seed) => seed.name === 'Dar').map((seed) => `${seed.direction}:${seed.name.toLowerCase()}`)
  expect(new Set(seededDarKeys).size).toBe(seededDarKeys.length)
})

test('gives income and expense defaults independent manual order', () => {
  const seeds = defaultCategorySeeds()
  expect(seeds.filter((seed) => seed.direction === 'expense').map((seed) => seed.sortOrder)).toEqual([...Array(22).keys()])
  expect(seeds.filter((seed) => seed.direction === 'income').map((seed) => seed.sortOrder)).toEqual([...Array(7).keys()])
})
