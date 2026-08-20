import { expect, test } from 'vitest'
import {
  defaultCategories,
  defaultCategorySeeds,
  DomainError,
  normalizeCategoryName,
  normalizeLabelName,
  parseCalendarDate,
  parseWholeCzk,
} from './domain.js'

test('normalizes category names and lowercase labels', () => {
  expect(normalizeCategoryName('  restaurace  ')).toBe('Restaurace')
  expect(normalizeCategoryName('úČty')).toBe('ÚČty')
  expect(normalizeLabelName('  FoundationGalaxy  ')).toBe('foundationgalaxy')
})

test('rejects invalid whole-CZK values and calendar dates', () => {
  expect(() => parseWholeCzk(-1, 'Částka', { allowNegative: false })).toThrow(DomainError)
  expect(() => parseWholeCzk(1.5, 'Částka', { allowNegative: true })).toThrow(DomainError)
  expect(() => parseCalendarDate('2026-02-30', 'Datum')).toThrow(DomainError)
})

test('defines the agreed one-time default category set', () => {
  expect(defaultCategories).toHaveLength(29)
  expect(defaultCategories.filter((category) => category.direction === 'expense')).toHaveLength(22)
  expect(defaultCategories.filter((category) => category.direction === 'income')).toHaveLength(7)
  expect(defaultCategories.some((category) => category.name === 'Měsíční změny')).toBe(false)
})

test('gives income and expense defaults independent manual order', () => {
  const seeds = defaultCategorySeeds()
  expect(seeds.filter((seed) => seed.direction === 'expense').map((seed) => seed.sortOrder)).toEqual([...Array(22).keys()])
  expect(seeds.filter((seed) => seed.direction === 'income').map((seed) => seed.sortOrder)).toEqual([...Array(7).keys()])
})
