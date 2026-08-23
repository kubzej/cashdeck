export type ScenarioTargetInput = {
  independenceNumberCzk: number
  baseWithdrawalRatePercent: number
  withdrawalRatePercent: number
  annualIrregularCzk: number
  excludeIrregularExpenses: boolean
  expensesDeltaPercent: number
}

// Reconstructs annual expenses from the already-computed independence number (which already bakes
// in every expense category plus irregular expenses, see server independence/repository.ts
// annualExpensesFrom), then re-applies the scenario's own withdrawal rate and expense adjustments —
// so this is the single place both the summary numbers and the chart's target line must agree on.
export function resolveScenarioTargetCzk(input: ScenarioTargetInput): number {
  const fullAnnualExpensesCzk = input.independenceNumberCzk * (input.baseWithdrawalRatePercent / 100)
  const annualExpensesCzk = input.excludeIrregularExpenses ? fullAnnualExpensesCzk - input.annualIrregularCzk : fullAnnualExpensesCzk
  return Math.round(annualExpensesCzk * (1 + input.expensesDeltaPercent / 100) * (100 / input.withdrawalRatePercent))
}

export type ScenarioInput = {
  startWealthCzk: number
  targetCzk: number
  realReturnPercent: number
  monthlyContributionCzk: number
  pauseMonths: number
  lumpSumCzk: number
  lumpSumMonth: number
}

export type ScenarioPoint = { years: number; amountCzk: number }
export type ScenarioResult = { points: ScenarioPoint[]; yearsToTarget: number | null }

const HORIZON_YEARS = 60
const SAMPLE_STEPS_PER_YEAR = 4

// Compound growth with a constant annual contribution over `years`, closed form (same shape as
// the server's independence/repository.ts solveYearsToTarget, duplicated here so the "what if"
// panel can recompute live on every keystroke without a round trip).
function valueAfterYears(startCzk: number, years: number, annualContributionCzk: number, realReturnRate: number): number {
  if (years <= 0) return startCzk
  if (realReturnRate === 0) return startCzk + annualContributionCzk * years
  const growth = Math.pow(1 + realReturnRate, years)
  return startCzk * growth + annualContributionCzk * ((growth - 1) / realReturnRate)
}

export function computeScenario(input: ScenarioInput): ScenarioResult {
  const rate = input.realReturnPercent / 100
  const pauseYears = Math.min(Math.max(0, input.pauseMonths) / 12, HORIZON_YEARS)
  const lumpYears = input.lumpSumCzk !== 0 ? Math.min(Math.max(0, input.lumpSumMonth) / 12, HORIZON_YEARS) : null
  const annualContributionCzk = Math.max(0, input.monthlyContributionCzk) * 12

  const boundaryYears = [...new Set([0, pauseYears, lumpYears, HORIZON_YEARS].filter((year): year is number => year !== null))].sort((a, b) => a - b)

  const initialAmountCzk = lumpYears !== null && lumpYears < 1e-9 ? input.startWealthCzk + input.lumpSumCzk : input.startWealthCzk
  const checkpoints: ScenarioPoint[] = [{ years: 0, amountCzk: initialAmountCzk }]
  for (let i = 1; i < boundaryYears.length; i++) {
    const segmentStart = boundaryYears[i - 1]
    const segmentEnd = boundaryYears[i]
    const contribution = segmentStart < pauseYears - 1e-9 ? 0 : annualContributionCzk
    let amountCzk = valueAfterYears(checkpoints[i - 1].amountCzk, segmentEnd - segmentStart, contribution, rate)
    if (lumpYears !== null && Math.abs(segmentEnd - lumpYears) < 1e-9) amountCzk += input.lumpSumCzk
    checkpoints.push({ years: segmentEnd, amountCzk })
  }

  const points = sampleCheckpoints(checkpoints, pauseYears, annualContributionCzk, rate)
  const yearsToTarget = solveYearsToTarget(checkpoints, pauseYears, annualContributionCzk, rate, input.targetCzk)
  return { points, yearsToTarget }
}

function sampleCheckpoints(checkpoints: ScenarioPoint[], pauseYears: number, annualContributionCzk: number, rate: number): ScenarioPoint[] {
  const points: ScenarioPoint[] = [checkpoints[0]]
  for (let i = 1; i < checkpoints.length; i++) {
    const segmentStart = checkpoints[i - 1].years
    const segmentEnd = checkpoints[i].years
    const contribution = segmentStart < pauseYears - 1e-9 ? 0 : annualContributionCzk
    const steps = Math.max(1, Math.round((segmentEnd - segmentStart) * SAMPLE_STEPS_PER_YEAR))
    for (let step = 1; step <= steps; step++) {
      const years = segmentStart + (segmentEnd - segmentStart) * (step / steps)
      const amountCzk = step === steps ? checkpoints[i].amountCzk : valueAfterYears(checkpoints[i - 1].amountCzk, years - segmentStart, contribution, rate)
      points.push({ years, amountCzk })
    }
  }
  return points
}

export type CoastFireInput = {
  startWealthCzk: number
  targetCzk: number
  realReturnPercent: number
  monthlyContributionCzk: number
  horizonYears: number
}

export type CoastFireResult = {
  isCoastingAlready: boolean
  coastNumberTodayCzk: number
  yearsToCoast: number | null
  coastDateWealthCzk: number | null
}

// The "coast number" for a given point in time is how much wealth would need to already be sitting
// there, growing untouched at realReturnRate for the years remaining until horizonYears, to reach
// targetCzk with zero further contributions from that point on.
function coastNumberAt(yearsFromNow: number, horizonYears: number, targetCzk: number, rate: number): number {
  const remainingYears = horizonYears - yearsFromNow
  if (remainingYears <= 0) return targetCzk
  if (rate === 0) return targetCzk
  return targetCzk / Math.pow(1 + rate, remainingYears)
}

// Finds the "coast date": the first point in time (given continued contributions until then) where
// accumulated wealth first covers the shrinking coast-number requirement for the chosen horizon —
// i.e. the point after which contributions could stop entirely and the target would still be reached
// by horizonYears through growth alone.
export function computeCoastFire(input: CoastFireInput): CoastFireResult {
  const rate = input.realReturnPercent / 100
  const annualContributionCzk = Math.max(0, input.monthlyContributionCzk) * 12
  const coastNumberTodayCzk = coastNumberAt(0, input.horizonYears, input.targetCzk, rate)

  if (input.startWealthCzk >= coastNumberTodayCzk) {
    return { isCoastingAlready: true, coastNumberTodayCzk, yearsToCoast: 0, coastDateWealthCzk: input.startWealthCzk }
  }

  const wealthAt = (yearsFromNow: number) => valueAfterYears(input.startWealthCzk, yearsFromNow, annualContributionCzk, rate)
  const differenceAt = (yearsFromNow: number) => wealthAt(yearsFromNow) - coastNumberAt(yearsFromNow, input.horizonYears, input.targetCzk, rate)

  if (differenceAt(input.horizonYears) < 0) {
    return { isCoastingAlready: false, coastNumberTodayCzk, yearsToCoast: null, coastDateWealthCzk: null }
  }

  let low = 0
  let high = input.horizonYears
  for (let iteration = 0; iteration < 60; iteration++) {
    const mid = (low + high) / 2
    if (differenceAt(mid) >= 0) high = mid
    else low = mid
  }
  const yearsToCoast = Math.ceil(high * 10) / 10
  return { isCoastingAlready: false, coastNumberTodayCzk, yearsToCoast, coastDateWealthCzk: wealthAt(yearsToCoast) }
}

function solveYearsToTarget(checkpoints: ScenarioPoint[], pauseYears: number, annualContributionCzk: number, rate: number, targetCzk: number): number | null {
  if (targetCzk <= 0 || checkpoints[0].amountCzk >= targetCzk) return 0

  for (let i = 1; i < checkpoints.length; i++) {
    const before = checkpoints[i - 1]
    const after = checkpoints[i]
    if (after.amountCzk < targetCzk) continue

    const segmentStart = before.years
    const contribution = segmentStart < pauseYears - 1e-9 ? 0 : annualContributionCzk
    let low = 0
    let high = after.years - segmentStart
    for (let iteration = 0; iteration < 60; iteration++) {
      const mid = (low + high) / 2
      if (valueAfterYears(before.amountCzk, mid, contribution, rate) >= targetCzk) high = mid
      else low = mid
    }
    return Math.ceil((segmentStart + high) * 10) / 10
  }

  return null
}
