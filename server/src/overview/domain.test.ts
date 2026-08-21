import { expect, test } from 'vitest'
import { DomainError } from '../management/domain.js'
import { parseOverviewQuery, parseOverviewSelectionQuery, resolveOverviewGranularity } from './domain.js'

const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'

test('parses bounded overview queries', () => {
  expect(parseOverviewQuery({ walletIds: walletId, period: 'month', dateFrom: '2026-08-01', dateTo: '2026-08-31' })).toEqual({ walletIds: [walletId], period: 'month', dateFrom: '2026-08-01', dateTo: '2026-08-31' })
  expect(parseOverviewQuery({ period: 'all' })).toEqual({ walletIds: null, period: 'all', dateFrom: null, dateTo: null })
})

test('rejects incomplete and unsafe overview ranges', () => {
  expect(() => parseOverviewQuery({ period: 'month', dateFrom: '2026-08-01' })).toThrow(DomainError)
  expect(() => parseOverviewQuery({ period: 'all', dateFrom: '2026-08-01', dateTo: '2026-08-31' })).toThrow(DomainError)
  expect(() => parseOverviewQuery({ period: 'month', dateFrom: '2026-08-31', dateTo: '2026-08-01' })).toThrow(DomainError)
  expect(() => parseOverviewQuery({ period: 'invalid', dateFrom: '2026-08-01', dateTo: '2026-08-31' })).toThrow(DomainError)
})

test('chooses a bounded chart granularity for every overview range', () => {
  expect(resolveOverviewGranularity('week', '2026-08-17', '2026-08-23')).toBe('day')
  expect(resolveOverviewGranularity('year', '2026-01-01', '2026-12-31')).toBe('month')
  expect(resolveOverviewGranularity('custom', '2024-01-01', '2026-08-01')).toBe('quarter')
  expect(resolveOverviewGranularity('all', '2015-01-01', '2026-08-01')).toBe('quarter')
})

test('parses a bounded selection trend query for a category or a label', () => {
  const categoryId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
  expect(parseOverviewSelectionQuery({ type: 'category', id: categoryId, walletIds: walletId, dateFrom: '2026-08-01', dateTo: '2026-08-31', granularity: 'day' }))
    .toEqual({ type: 'category', id: categoryId, walletIds: [walletId], dateFrom: '2026-08-01', dateTo: '2026-08-31', granularity: 'day' })
  expect(parseOverviewSelectionQuery({ type: 'label', id: categoryId, dateFrom: '2026-08-01', dateTo: '2026-08-31', granularity: 'month' }))
    .toEqual({ type: 'label', id: categoryId, walletIds: null, dateFrom: '2026-08-01', dateTo: '2026-08-31', granularity: 'month' })
})

test('rejects invalid or reversed selection trend queries', () => {
  const categoryId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
  expect(() => parseOverviewSelectionQuery({ type: 'invalid', id: categoryId, dateFrom: '2026-08-01', dateTo: '2026-08-31', granularity: 'day' })).toThrow(DomainError)
  expect(() => parseOverviewSelectionQuery({ type: 'category', id: 'not-a-uuid', dateFrom: '2026-08-01', dateTo: '2026-08-31', granularity: 'day' })).toThrow(DomainError)
  expect(() => parseOverviewSelectionQuery({ type: 'category', id: categoryId, dateFrom: '2026-08-31', dateTo: '2026-08-01', granularity: 'day' })).toThrow(DomainError)
  expect(() => parseOverviewSelectionQuery({ type: 'category', id: categoryId, dateFrom: '2026-08-01', dateTo: '2026-08-31', granularity: 'invalid' })).toThrow(DomainError)
})
