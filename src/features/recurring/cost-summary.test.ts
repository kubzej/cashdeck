import { expect, test } from 'vitest'
import type { RecurringRule } from './api'
import { computeCostSummary, monthlyEquivalent } from './cost-summary'

const daysPerMonth = 30.436875

function rule(overrides: Partial<RecurringRule>): RecurringRule {
  return {
    id: 'rule-1', name: 'Pravidlo', kind: 'transaction', status: 'active', amountCzk: 1000, frequency: 'monthly', customIntervalDays: null,
    categoryId: 'category-home', categoryName: 'Domov', categoryIconKey: 'house', categoryColorKey: 'orange', categoryDirection: 'expense',
    ...overrides,
  } as RecurringRule
}

test('calendar frequencies convert to a monthly amount by their share of a month', () => {
  expect(monthlyEquivalent(1000, 'monthly', null)).toBe(1000)
  expect(monthlyEquivalent(2000, 'every_two_months', null)).toBe(1000)
  expect(monthlyEquivalent(3000, 'every_three_months', null)).toBe(1000)
  expect(monthlyEquivalent(6000, 'semiannual', null)).toBe(1000)
  expect(monthlyEquivalent(12000, 'yearly', null)).toBe(1000)
})

test('day-based frequencies use the average month length, not a flat 30 days', () => {
  expect(monthlyEquivalent(1, 'daily', null)).toBeCloseTo(daysPerMonth)
  expect(monthlyEquivalent(7, 'weekly', null)).toBeCloseTo(daysPerMonth)
  expect(monthlyEquivalent(14, 'biweekly', null)).toBeCloseTo(daysPerMonth)
  expect(monthlyEquivalent(10, 'custom_days', 10)).toBeCloseTo(daysPerMonth)
  expect(monthlyEquivalent(10, 'custom_days', null)).toBeCloseTo(10 * daysPerMonth)
})

test('only active transaction rules count; transfers, ended rules and rules without a category are left out', () => {
  const summary = computeCostSummary([
    rule({ id: 'rent', amountCzk: 15000 }),
    rule({ id: 'salary', amountCzk: 40000, categoryId: 'category-pay', categoryName: 'Výplata', categoryDirection: 'income' }),
    rule({ id: 'transfer', kind: 'transfer', amountCzk: 5000, categoryId: null, categoryName: null, categoryIconKey: null, categoryColorKey: null, categoryDirection: null }),
    rule({ id: 'ended', status: 'ended', amountCzk: 999 }),
    rule({ id: 'uncategorized', amountCzk: 777, categoryId: null }),
  ])

  expect(summary.expenseMonthlyCzk).toBe(15000)
  expect(summary.incomeMonthlyCzk).toBe(40000)
  expect(summary.cashflowMonthlyCzk).toBe(25000)
  expect(summary.expenseYearlyCzk).toBe(180000)
  expect(summary.cashflowYearlyCzk).toBe(300000)
})

test('rules in one category add up, categories sort by their share, and amounts are rounded once at the end', () => {
  const summary = computeCostSummary([
    rule({ id: 'a', amountCzk: 1000, categoryId: 'category-small', categoryName: 'Malé' }),
    rule({ id: 'b', amountCzk: 12000, frequency: 'yearly' }),
    rule({ id: 'c', amountCzk: 1000 }),
    rule({ id: 'd', amountCzk: 100, frequency: 'weekly', categoryId: 'category-small', categoryName: 'Malé' }),
  ])

  expect(summary.expenseCategories.map((category) => category.categoryId)).toEqual(['category-home', 'category-small'])
  expect(summary.expenseCategories[0]).toMatchObject({ monthlyCzk: 2000, yearlyCzk: 24000 })
  // 1000 + 100 * (30.436875 / 7) = 1434.8, rounded once after summing.
  expect(summary.expenseCategories[1].monthlyCzk).toBe(1435)
  expect(summary.expenseMonthlyCzk).toBe(Math.round(2000 + 1000 + 100 * (daysPerMonth / 7)))
})

test('an empty or all-excluded list gives a zero summary', () => {
  const summary = computeCostSummary([rule({ status: 'ended' })])
  expect(summary).toMatchObject({ expenseMonthlyCzk: 0, incomeMonthlyCzk: 0, cashflowMonthlyCzk: 0, expenseCategories: [], incomeCategories: [] })
})
