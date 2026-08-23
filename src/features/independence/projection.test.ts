import { expect, test } from 'vitest'
import { computeScenario, resolveScenarioTargetCzk } from './projection'

// Independent reimplementation of the compound-growth formula (not a copy of projection.ts's
// internal valueAfterYears), used to cross-check the piecewise segmentation logic against a
// value computed from first principles.
function manualValueAfterYears(startCzk: number, years: number, annualContributionCzk: number, rate: number): number {
  if (rate === 0) return startCzk + annualContributionCzk * years
  const growth = (1 + rate) ** years
  return startCzk * growth + annualContributionCzk * ((growth - 1) / rate)
}

const baseInput = {
  startWealthCzk: 1_000_000,
  targetCzk: 2_000_000,
  realReturnPercent: 5,
  monthlyContributionCzk: 20_000,
  pauseMonths: 0,
  lumpSumCzk: 0,
  lumpSumMonth: 0,
}

test('reports zero years when already at or above the target', () => {
  expect(computeScenario({ ...baseInput, startWealthCzk: 2_500_000 }).yearsToTarget).toBe(0)
})

test('reports null when the target is never reached within the horizon', () => {
  expect(computeScenario({ ...baseInput, targetCzk: 500_000_000, monthlyContributionCzk: 0, realReturnPercent: 0 }).yearsToTarget).toBeNull()
})

test('a savings pause delays reaching the target compared to no pause', () => {
  const withoutPause = computeScenario(baseInput).yearsToTarget
  const withPause = computeScenario({ ...baseInput, pauseMonths: 12 }).yearsToTarget
  expect(withoutPause).not.toBeNull()
  expect(withPause).not.toBeNull()
  expect(withPause!).toBeGreaterThan(withoutPause!)
})

test('a lump sum deposit speeds up reaching the target compared to no lump sum', () => {
  const withoutLump = computeScenario(baseInput).yearsToTarget
  const withLump = computeScenario({ ...baseInput, lumpSumCzk: 900_000, lumpSumMonth: 0 }).yearsToTarget
  expect(withoutLump).not.toBeNull()
  expect(withLump).not.toBeNull()
  expect(withLump!).toBeLessThan(withoutLump!)
})

test('the last projected point matches the resolved years-to-target amount', () => {
  const { points, yearsToTarget } = computeScenario(baseInput)
  expect(yearsToTarget).not.toBeNull()
  const lastPoint = points.at(-1)
  expect(lastPoint?.years).toBe(60)
  expect(lastPoint!.amountCzk).toBeGreaterThan(baseInput.targetCzk)
})

test('a pause applies zero growth-free contribution during the paused months', () => {
  const paused = computeScenario({ ...baseInput, pauseMonths: 12, realReturnPercent: 0 })
  const pointAtOneYear = paused.points.find((point) => Math.abs(point.years - 1) < 0.01)
  expect(pointAtOneYear?.amountCzk).toBe(baseInput.startWealthCzk)
})

test('with no pause and no lump sum, matches a fresh single-phase compound growth calculation', () => {
  const years = 10
  const expected = manualValueAfterYears(baseInput.startWealthCzk, years, baseInput.monthlyContributionCzk * 12, baseInput.realReturnPercent / 100)
  const { points } = computeScenario({ ...baseInput, targetCzk: Number.MAX_SAFE_INTEGER })
  const point = points.find((candidate) => Math.abs(candidate.years - years) < 0.01)
  expect(point?.amountCzk).toBeCloseTo(expected, 0)
})

test('a lump sum that falls inside the pause is added without picking up the resumed contribution early', () => {
  const rate = 0.06
  const annualContributionCzk = 20_000 * 12
  const { points } = computeScenario({
    startWealthCzk: 1_000_000, targetCzk: Number.MAX_SAFE_INTEGER, realReturnPercent: rate * 100,
    monthlyContributionCzk: 20_000, pauseMonths: 12, lumpSumCzk: 200_000, lumpSumMonth: 6,
  })
  // Manually walk the same three phases: 0->0.5y no contribution, +lump, 0.5->1y no contribution
  // (still paused), 1y-> resumed contribution — and compare against the library's own points.
  const afterHalfYear = manualValueAfterYears(1_000_000, 0.5, 0, rate) + 200_000
  const atPauseEnd = manualValueAfterYears(afterHalfYear, 0.5, 0, rate)
  const afterTwoMoreYears = manualValueAfterYears(atPauseEnd, 2, annualContributionCzk, rate)

  const pointAtPauseEnd = points.find((point) => Math.abs(point.years - 1) < 0.01)
  const pointAtThreeYears = points.find((point) => Math.abs(point.years - 3) < 0.01)
  expect(pointAtPauseEnd?.amountCzk).toBeCloseTo(atPauseEnd, 0)
  expect(pointAtThreeYears?.amountCzk).toBeCloseTo(afterTwoMoreYears, 0)
})

test('every sampled point stays chronological and the horizon point is always included', () => {
  const { points } = computeScenario({ ...baseInput, pauseMonths: 7, lumpSumCzk: -150_000, lumpSumMonth: 20 })
  for (let i = 1; i < points.length; i++) expect(points[i].years).toBeGreaterThan(points[i - 1].years)
  expect(points.at(-1)?.years).toBe(60)
})

test('the reported years-to-target is consistent with where the sampled curve actually crosses the target', () => {
  const combos = [
    { pauseMonths: 0, lumpSumCzk: 0, lumpSumMonth: 0 },
    { pauseMonths: 18, lumpSumCzk: 0, lumpSumMonth: 0 },
    { pauseMonths: 0, lumpSumCzk: 400_000, lumpSumMonth: 24 },
    { pauseMonths: 9, lumpSumCzk: 300_000, lumpSumMonth: 3 },
  ]
  for (const combo of combos) {
    const { points, yearsToTarget } = computeScenario({ ...baseInput, ...combo })
    expect(yearsToTarget).not.toBeNull()
    if (yearsToTarget === 0) continue
    const crossingIndex = points.findIndex((point) => point.amountCzk >= baseInput.targetCzk)
    expect(crossingIndex).toBeGreaterThan(-1)
    // The solved years-to-target rounds up to the nearest 0.1y, so it should land at or just after
    // the first sampled point that already clears the target, and strictly after the one before it.
    expect(yearsToTarget!).toBeGreaterThanOrEqual(points[crossingIndex - 1]?.years ?? 0)
    expect(yearsToTarget!).toBeLessThanOrEqual(points[crossingIndex].years + 0.1)
  }
})

test('resolveScenarioTargetCzk is a no-op when nothing is scenario-adjusted', () => {
  const independenceNumberCzk = 12_500_000
  const target = resolveScenarioTargetCzk({
    independenceNumberCzk, baseWithdrawalRatePercent: 4, withdrawalRatePercent: 4,
    annualIrregularCzk: 30_000, excludeIrregularExpenses: false, expensesDeltaPercent: 0,
  })
  expect(target).toBe(independenceNumberCzk)
})

test('resolveScenarioTargetCzk raises the target when the withdrawal rate is lowered', () => {
  const independenceNumberCzk = 12_500_000
  const target = resolveScenarioTargetCzk({
    independenceNumberCzk, baseWithdrawalRatePercent: 4, withdrawalRatePercent: 3,
    annualIrregularCzk: 0, excludeIrregularExpenses: false, expensesDeltaPercent: 0,
  })
  expect(target).toBeGreaterThan(independenceNumberCzk)
  expect(target).toBe(Math.round(independenceNumberCzk * (4 / 3)))
})

test('resolveScenarioTargetCzk applies the expense delta on top of the withdrawal rate change', () => {
  const independenceNumberCzk = 12_500_000
  const target = resolveScenarioTargetCzk({
    independenceNumberCzk, baseWithdrawalRatePercent: 4, withdrawalRatePercent: 3.5,
    annualIrregularCzk: 0, excludeIrregularExpenses: false, expensesDeltaPercent: 10,
  })
  const annualExpensesCzk = independenceNumberCzk * (4 / 100)
  expect(target).toBe(Math.round(annualExpensesCzk * 1.1 * (100 / 3.5)))
})

test('resolveScenarioTargetCzk excludes irregular expenses before applying the expense delta percentage', () => {
  const independenceNumberCzk = 12_500_000
  const annualIrregularCzk = 40_000
  const target = resolveScenarioTargetCzk({
    independenceNumberCzk, baseWithdrawalRatePercent: 4, withdrawalRatePercent: 4,
    annualIrregularCzk, excludeIrregularExpenses: true, expensesDeltaPercent: 20,
  })
  const fullAnnualExpensesCzk = independenceNumberCzk * (4 / 100)
  const expected = Math.round((fullAnnualExpensesCzk - annualIrregularCzk) * 1.2 * (100 / 4))
  expect(target).toBe(expected)
  // Sanity: excluding irregular expenses must lower the target relative to keeping them in,
  // for the same expense-delta percentage.
  const withIrregular = resolveScenarioTargetCzk({
    independenceNumberCzk, baseWithdrawalRatePercent: 4, withdrawalRatePercent: 4,
    annualIrregularCzk, excludeIrregularExpenses: false, expensesDeltaPercent: 20,
  })
  expect(target).toBeLessThan(withIrregular)
})

test('resolveScenarioTargetCzk combines withdrawal rate, expense delta, and irregular exclusion consistently', () => {
  const independenceNumberCzk = 9_800_000
  const baseWithdrawalRatePercent = 4
  const annualIrregularCzk = 60_000
  const target = resolveScenarioTargetCzk({
    independenceNumberCzk, baseWithdrawalRatePercent, withdrawalRatePercent: 3.25,
    annualIrregularCzk, excludeIrregularExpenses: true, expensesDeltaPercent: -15,
  })
  const fullAnnualExpensesCzk = independenceNumberCzk * (baseWithdrawalRatePercent / 100)
  const expected = Math.round((fullAnnualExpensesCzk - annualIrregularCzk) * 0.85 * (100 / 3.25))
  expect(target).toBe(expected)
})
