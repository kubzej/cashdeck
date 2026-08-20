import { describe, expect, test } from 'vitest'
import { getNextOccurrenceDate, isRecurringOccurrenceDue, isRecurringRuleEnded, type RecurringSchedule } from './schedule.js'

function schedule(overrides: Partial<RecurringSchedule> = {}): RecurringSchedule {
  return {
    frequency: 'monthly',
    customIntervalDays: null,
    scheduleAnchorDate: '2026-08-18',
    nextOccurrenceDate: '2026-08-18',
    ...overrides,
  }
}

describe('getNextOccurrenceDate', () => {
  test('keeps the same calendar day for monthly recurrence', () => {
    expect(getNextOccurrenceDate(schedule())).toBe('2026-09-18')
    expect(getNextOccurrenceDate(schedule({ nextOccurrenceDate: '2026-09-18' }))).toBe('2026-10-18')
  })

  test('uses the original anchor day across short months', () => {
    expect(getNextOccurrenceDate(schedule({ scheduleAnchorDate: '2026-01-31', nextOccurrenceDate: '2026-01-31' }))).toBe('2026-02-28')
    expect(getNextOccurrenceDate(schedule({ scheduleAnchorDate: '2026-01-31', nextOccurrenceDate: '2026-02-28' }))).toBe('2026-03-31')
  })

  test('keeps weekday-based schedules as exact weekly intervals', () => {
    expect(getNextOccurrenceDate(schedule({ frequency: 'daily', nextOccurrenceDate: '2026-08-16' }))).toBe('2026-08-17')
    expect(getNextOccurrenceDate(schedule({ frequency: 'weekly', nextOccurrenceDate: '2026-08-16' }))).toBe('2026-08-23')
    expect(getNextOccurrenceDate(schedule({ frequency: 'biweekly', nextOccurrenceDate: '2026-08-16' }))).toBe('2026-08-30')
  })

  test('supports the requested calendar intervals and custom days', () => {
    expect(getNextOccurrenceDate(schedule({ frequency: 'every_two_months' }))).toBe('2026-10-18')
    expect(getNextOccurrenceDate(schedule({ frequency: 'every_three_months' }))).toBe('2026-11-18')
    expect(getNextOccurrenceDate(schedule({ frequency: 'semiannual' }))).toBe('2027-02-18')
    expect(getNextOccurrenceDate(schedule({ frequency: 'yearly' }))).toBe('2027-08-18')
    expect(getNextOccurrenceDate(schedule({ frequency: 'custom_days', customIntervalDays: 30 }))).toBe('2026-09-17')
  })

  test('preserves the anchor across leap years for calendar schedules', () => {
    expect(getNextOccurrenceDate(schedule({ frequency: 'yearly', scheduleAnchorDate: '2024-02-29', nextOccurrenceDate: '2024-02-29' }))).toBe('2025-02-28')
    expect(getNextOccurrenceDate(schedule({ frequency: 'yearly', scheduleAnchorDate: '2024-02-29', nextOccurrenceDate: '2027-02-28' }))).toBe('2028-02-29')
  })
})

test('treats only due, non-ended rules as generatable', () => {
  expect(isRecurringOccurrenceDue({ nextOccurrenceDate: '2026-08-20', endsOn: null, today: '2026-08-20' })).toBe(true)
  expect(isRecurringOccurrenceDue({ nextOccurrenceDate: '2026-08-21', endsOn: null, today: '2026-08-20' })).toBe(false)
  expect(isRecurringOccurrenceDue({ nextOccurrenceDate: '2026-08-20', endsOn: '2026-08-19', today: '2026-08-20' })).toBe(false)
})

test('marks a rule as ended after its final occurrence advances past its end date', () => {
  expect(isRecurringRuleEnded({ nextOccurrenceDate: '2026-09-20', endsOn: '2026-08-20' })).toBe(true)
  expect(isRecurringRuleEnded({ nextOccurrenceDate: '2026-08-20', endsOn: '2026-08-20' })).toBe(false)
  expect(isRecurringRuleEnded({ nextOccurrenceDate: '2026-09-20', endsOn: null })).toBe(false)
})
