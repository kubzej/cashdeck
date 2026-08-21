import { expect, test } from 'vitest'
import { DomainError } from '../management/domain.js'
import { assertForwardSchedule, parseRecurringRule } from './domain.js'

const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const categoryId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef124'
const destinationWalletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef125'
const labelId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef126'

test('parses a future recurring transaction rule and normalizes its text', () => {
  expect(parseRecurringRule({
    name: '  Nájem  ', kind: 'transaction', amountCzk: 18000, walletId, categoryId,
    note: '  Září  ', labelIds: [labelId], frequency: 'monthly', customIntervalDays: null,
    nextOccurrenceDate: '2026-09-18', endsOn: null,
  }, '2026-08-20')).toEqual({
    name: 'Nájem', kind: 'transaction', amountCzk: 18000, walletId, categoryId,
    sourceWalletId: null, destinationWalletId: null, note: 'Září', labelIds: [labelId],
    frequency: 'monthly', customIntervalDays: null, nextOccurrenceDate: '2026-09-18', endsOn: null,
  })
})

test('parses a recurring transfer with a custom day interval', () => {
  expect(parseRecurringRule({
    name: 'Přesun do rezervy', kind: 'transfer', amountCzk: 5000,
    sourceWalletId: walletId, destinationWalletId, note: null, labelIds: [],
    frequency: 'custom_days', customIntervalDays: 30, nextOccurrenceDate: '2026-08-20', endsOn: '2027-01-01',
  }, '2026-08-20')).toMatchObject({
    kind: 'transfer', walletId: null, categoryId: null, sourceWalletId: walletId,
    destinationWalletId, frequency: 'custom_days', customIntervalDays: 30,
  })
})

test('allows the final occurrence on the end date', () => {
  const parsed = parseRecurringRule({
    name: 'Poslední splátka', kind: 'transaction', amountCzk: 1000, walletId, categoryId,
    note: null, labelIds: [], frequency: 'monthly', customIntervalDays: null,
    nextOccurrenceDate: '2026-08-20', endsOn: '2026-08-20',
  }, '2026-08-20')

  expect(parsed.endsOn).toBe(parsed.nextOccurrenceDate)
})

test('rejects a past next occurrence and malformed rule payloads', () => {
  const create = (overrides: Record<string, unknown>) => parseRecurringRule({
    name: 'Nájem', kind: 'transaction', amountCzk: 1, walletId, categoryId,
    frequency: 'monthly', customIntervalDays: null, nextOccurrenceDate: '2026-08-20', endsOn: null,
    ...overrides,
  }, '2026-08-20')

  expect(() => create({ frequency: 'custom_days', customIntervalDays: 0 })).toThrow(DomainError)
  expect(() => create({ frequency: 'custom_days', customIntervalDays: null })).toThrow(DomainError)
  expect(() => create({ kind: 'transfer', sourceWalletId: walletId, destinationWalletId: walletId })).toThrow(DomainError)
  expect(() => create({ labelIds: [labelId, labelId] })).toThrow(DomainError)
  expect(() => create({ sourceWalletId: destinationWalletId })).toThrow(DomainError)
})

test('assertForwardSchedule rejects a past next occurrence or an end date before it', () => {
  expect(() => assertForwardSchedule('2026-08-19', null, '2026-08-20')).toThrow(DomainError)
  expect(() => assertForwardSchedule('2026-08-20', '2026-08-19', '2026-08-20')).toThrow(DomainError)
  expect(() => assertForwardSchedule('2026-08-20', '2026-08-20', '2026-08-20')).not.toThrow()
  expect(() => assertForwardSchedule('2026-08-20', null, '2026-08-20')).not.toThrow()
})

test('a rule creation route must call assertForwardSchedule itself — parseRecurringRule no longer rejects a past/inconsistent schedule on its own, so an update can preserve an ended rule\'s frozen dates', () => {
  expect(parseRecurringRule({
    name: 'Nájem', kind: 'transaction', amountCzk: 1000, walletId, categoryId,
    note: null, labelIds: [], frequency: 'monthly', customIntervalDays: null,
    nextOccurrenceDate: '2026-09-20', endsOn: '2026-08-20',
  }, '2026-08-21')).toMatchObject({ nextOccurrenceDate: '2026-09-20', endsOn: '2026-08-20' })
})
