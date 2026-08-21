import type { Pool } from 'pg'
import { beforeEach, expect, test, vi } from 'vitest'
import { resetWealthCacheForTests } from '../wealth-cache.js'
import { createIndependenceRepository } from './repository.js'

beforeEach(() => resetWealthCacheForTests())

// Splits a total/available pair into two mock wallet_balances rows (one available_now, one
// not), matching walletBalancesSql's new per-wallet-row shape.
function walletBalanceRows(totalCzk: number, availableCzk: number) {
  const rows = [{ wallet_type: 'investment' as const, available_now: true, current_balance_czk: String(availableCzk) }]
  const lockedCzk = totalCzk - availableCzk
  if (lockedCzk > 0) rows.push({ wallet_type: 'pension' as const, available_now: false, current_balance_czk: String(lockedCzk) })
  return rows
}

const settingsRow = {
  withdrawal_rate_percent: '4.00',
  expected_real_return_percent: '4.00',
  inflation_rate_percent: '2.50',
  monthly_contribution_czk: '5000',
  housing_monthly_czk: '15000',
  food_monthly_czk: '8000',
  transport_monthly_czk: '2000',
  health_monthly_czk: '1500',
  leisure_monthly_czk: '4000',
  clothing_monthly_czk: '1000',
  family_monthly_czk: '0',
  reserve_monthly_czk: '2000',
}

test('sums the 8 category fields and irregular expenses into one annual figure, then applies the withdrawal rate', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [settingsRow] })
    .mockResolvedValueOnce({ rows: [{ id: 'irregular-1', name: 'Výměna auta', amount_czk: '400000', frequency_years: 8, sort_order: 0 }] })
    .mockResolvedValueOnce({ rows: walletBalanceRows(2_000_000, 1_500_000) })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  const result = await repository.getProgress('user-1')

  // (15000+8000+2000+1500+4000+1000+0+2000)*12 = 402000, plus 400000/8 = 50000 amortized -> 452000
  expect(result.annualExpensesCzk).toBe(452_000)
  // 452000 * (100/4) = 11 300 000
  expect(result.independenceNumberCzk).toBe(11_300_000)
  expect(result.totalWealthCzk).toBe(2_000_000)
  expect(result.availableWealthCzk).toBe(1_500_000)
  expect(result.totalProgressPercent).toBeCloseTo((2_000_000 / 11_300_000) * 100, 5)
  expect(result.availableProgressPercent).toBeCloseTo((1_500_000 / 11_300_000) * 100, 5)
})

test('the years-to-target solver returns a horizon whose compounded value actually reaches the target', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [settingsRow] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: walletBalanceRows(2_000_000, 1_500_000) })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  const result = await repository.getProgress('user-1')

  expect(result.yearsToTotal).not.toBeNull()
  expect(result.yearsToAvailable).not.toBeNull()
  // Less wealth to start from should never reach the same target sooner.
  expect(result.yearsToAvailable!).toBeGreaterThanOrEqual(result.yearsToTotal!)

  // Independently recompute the growing-annuity formula with the solved horizon and confirm it
  // actually reaches (or just clears) the target — this validates the solver's own math rather
  // than a hand-picked expected year count.
  const realReturn = 0.04
  const annualContribution = 5_000 * 12
  for (const [startWealth, years] of [[2_000_000, result.yearsToTotal!], [1_500_000, result.yearsToAvailable!]] as const) {
    const growth = Math.pow(1 + realReturn, years)
    const projected = startWealth * growth + annualContribution * ((growth - 1) / realReturn)
    expect(projected).toBeGreaterThanOrEqual(result.independenceNumberCzk - 1)
  }
})

test('returns no projection when there is neither contribution nor real return to close the gap', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ ...settingsRow, expected_real_return_percent: '0.00', monthly_contribution_czk: '0' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: walletBalanceRows(1_000_000, 500_000) })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  const result = await repository.getProgress('user-1')

  expect(result.yearsToTotal).toBeNull()
  expect(result.yearsToAvailable).toBeNull()
  expect(result.futureAnnualExpensesCzk).toBeNull()
})

test('reports zero years when wealth already meets or exceeds the target', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [settingsRow] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: walletBalanceRows(20_000_000, 20_000_000) })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  const result = await repository.getProgress('user-1')

  expect(result.yearsToTotal).toBe(0)
  expect(result.yearsToAvailable).toBe(0)
})

test('returns a zeroed progress with wealth still reported when independence settings were never saved', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: walletBalanceRows(300_000, 100_000) })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  const result = await repository.getProgress('user-1')

  expect(result.hasSettings).toBe(false)
  expect(result.annualExpensesCzk).toBe(0)
  expect(result.independenceNumberCzk).toBe(0)
  expect(result.totalWealthCzk).toBe(300_000)
  expect(result.availableWealthCzk).toBe(100_000)
  expect(result.yearsToTotal).toBeNull()
  expect(result.yearsToAvailable).toBeNull()
})

test('groups wealth by wallet type across independence-flagged wallets', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [settingsRow] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        { wallet_type: 'investment', available_now: true, current_balance_czk: '900000' },
        { wallet_type: 'crypto', available_now: true, current_balance_czk: '200000' },
        { wallet_type: 'crypto', available_now: true, current_balance_czk: '50000' },
        { wallet_type: 'pension', available_now: false, current_balance_czk: '350000' },
      ],
    })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  const result = await repository.getProgress('user-1')

  expect(result.totalWealthCzk).toBe(1_500_000)
  expect(result.wealthByType).toEqual([
    { walletType: 'investment', amountCzk: 900_000 },
    { walletType: 'pension', amountCzk: 350_000 },
    { walletType: 'crypto', amountCzk: 250_000 },
  ])
})

test('return sensitivity always includes the configured rate plus the fixed comparison points, without duplicating a rate that already matches', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [settingsRow] }) // expected_real_return_percent: 4.00
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: walletBalanceRows(2_000_000, 1_500_000) })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  const result = await repository.getProgress('user-1')

  const rates = result.returnSensitivity.map((entry) => entry.realReturnPercent)
  expect(rates).toEqual([4, 6, 8, 10, 12])
  const own = result.returnSensitivity.find((entry) => entry.realReturnPercent === 4)
  expect(own?.yearsToTotal).toBe(result.yearsToTotal)
  expect(own?.yearsToAvailable).toBe(result.yearsToAvailable)

  const query2 = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ ...settingsRow, expected_real_return_percent: '8.00' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: walletBalanceRows(2_000_000, 1_500_000) })
  const repository2 = createIndependenceRepository({ query: query2 } as unknown as Pool)

  const result2 = await repository2.getProgress('user-1')
  expect(result2.returnSensitivity.map((entry) => entry.realReturnPercent)).toEqual([6, 8, 10, 12])
})

test('upserts settings via insert-on-conflict scoped to the user', async () => {
  const query = vi.fn().mockResolvedValueOnce({ rows: [settingsRow] })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  await repository.upsertSettings('user-1', {
    withdrawalRatePercent: 4,
    expectedRealReturnPercent: 4,
    inflationRatePercent: 2.5,
    monthlyContributionCzk: 5_000,
    housingMonthlyCzk: 15_000,
    foodMonthlyCzk: 8_000,
    transportMonthlyCzk: 2_000,
    healthMonthlyCzk: 1_500,
    leisureMonthlyCzk: 4_000,
    clothingMonthlyCzk: 1_000,
    familyMonthlyCzk: 0,
    reserveMonthlyCzk: 2_000,
  })

  const [sql, values] = query.mock.calls[0]
  expect(String(sql)).toContain('on conflict (user_id) do update')
  expect(values[0]).toBe('user-1')
})

test('maps the wealth series rows and scopes the query to the user', async () => {
  const query = vi.fn().mockResolvedValueOnce({
    rows: [
      { bucket_date: '2025-09-01', amount_czk: '80000' },
      { bucket_date: '2025-10-01', amount_czk: '95000' },
    ],
  })
  const repository = createIndependenceRepository({ query } as unknown as Pool)

  const points = await repository.getWealthSeries('user-1')

  expect(points).toEqual([{ date: '2025-09-01', amountCzk: 80_000 }, { date: '2025-10-01', amountCzk: 95_000 }])
  expect(query.mock.calls[0][1]).toEqual(['user-1'])
  expect(String(query.mock.calls[0][0])).toContain('counts_toward_independence')
})
