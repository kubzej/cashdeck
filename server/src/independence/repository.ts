import type { Pool } from 'pg'
import { DomainError, type WalletType } from '../management/domain.js'
import { withWealthCache } from '../wealth-cache.js'
import type { IndependenceSettingsInput, IrregularExpenseInput } from './domain.js'

export type IndependenceSettings = {
  withdrawalRatePercent: number
  expectedRealReturnPercent: number
  inflationRatePercent: number
  monthlyContributionCzk: number
  housingMonthlyCzk: number
  foodMonthlyCzk: number
  transportMonthlyCzk: number
  healthMonthlyCzk: number
  leisureMonthlyCzk: number
  clothingMonthlyCzk: number
  familyMonthlyCzk: number
  reserveMonthlyCzk: number
}

export type IrregularExpense = {
  id: string
  name: string
  amountCzk: number
  frequencyYears: number
  sortOrder: number
}

export type IndependenceProgress = {
  hasSettings: boolean
  annualExpensesCzk: number
  independenceNumberCzk: number
  totalWealthCzk: number
  availableWealthCzk: number
  totalProgressPercent: number
  availableProgressPercent: number
  yearsToTotal: number | null
  yearsToAvailable: number | null
  futureAnnualExpensesCzk: number | null
  wealthByType: Array<{ walletType: WalletType; amountCzk: number }>
  returnSensitivity: Array<{ realReturnPercent: number; yearsToTotal: number | null; yearsToAvailable: number | null }>
}

export type WealthSeriesPoint = { date: string; amountCzk: number }

export type IndependenceRepository = {
  getSettings(userId: string): Promise<IndependenceSettings | null>
  upsertSettings(userId: string, input: IndependenceSettingsInput): Promise<IndependenceSettings>
  listIrregularExpenses(userId: string): Promise<IrregularExpense[]>
  createIrregularExpense(userId: string, input: IrregularExpenseInput): Promise<IrregularExpense>
  updateIrregularExpense(userId: string, id: string, input: Partial<IrregularExpenseInput>): Promise<IrregularExpense | null>
  deleteIrregularExpense(userId: string, id: string): Promise<boolean>
  getProgress(userId: string): Promise<IndependenceProgress>
  getWealthSeries(userId: string): Promise<WealthSeriesPoint[]>
}

type SettingsRow = {
  withdrawal_rate_percent: string
  expected_real_return_percent: string
  inflation_rate_percent: string
  monthly_contribution_czk: string
  housing_monthly_czk: string
  food_monthly_czk: string
  transport_monthly_czk: string
  health_monthly_czk: string
  leisure_monthly_czk: string
  clothing_monthly_czk: string
  family_monthly_czk: string
  reserve_monthly_czk: string
}

type IrregularExpenseRow = {
  id: string
  name: string
  amount_czk: string
  frequency_years: number
  sort_order: number
}

type WalletBalanceRow = {
  wallet_type: WalletType
  available_now: boolean
  current_balance_czk: string
}

function toWealthByType(rows: WalletBalanceRow[]) {
  const byType = new Map<WalletType, number>()
  for (const row of rows) byType.set(row.wallet_type, (byType.get(row.wallet_type) ?? 0) + Number(row.current_balance_czk))
  return [...byType.entries()]
    .map(([walletType, amountCzk]) => ({ walletType, amountCzk }))
    .sort((a, b) => b.amountCzk - a.amountCzk)
}

// Fixed reference points for the "what if the real return were different" comparison — always
// includes the user's own configured rate so their actual assumption shows up in the same list,
// even if it doesn't land on one of the round numbers.
const sensitivityBaseRates = [6, 8, 10, 12]

function sensitivityRatesIncluding(ownRatePercent: number) {
  return sensitivityBaseRates.includes(ownRatePercent)
    ? sensitivityBaseRates
    : [...sensitivityBaseRates, ownRatePercent].sort((a, b) => a - b)
}

function toSettings(row: SettingsRow): IndependenceSettings {
  return {
    withdrawalRatePercent: Number(row.withdrawal_rate_percent),
    expectedRealReturnPercent: Number(row.expected_real_return_percent),
    inflationRatePercent: Number(row.inflation_rate_percent),
    monthlyContributionCzk: Number(row.monthly_contribution_czk),
    housingMonthlyCzk: Number(row.housing_monthly_czk),
    foodMonthlyCzk: Number(row.food_monthly_czk),
    transportMonthlyCzk: Number(row.transport_monthly_czk),
    healthMonthlyCzk: Number(row.health_monthly_czk),
    leisureMonthlyCzk: Number(row.leisure_monthly_czk),
    clothingMonthlyCzk: Number(row.clothing_monthly_czk),
    familyMonthlyCzk: Number(row.family_monthly_czk),
    reserveMonthlyCzk: Number(row.reserve_monthly_czk),
  }
}

function toIrregularExpense(row: IrregularExpenseRow): IrregularExpense {
  return { id: row.id, name: row.name, amountCzk: Number(row.amount_czk), frequencyYears: row.frequency_years, sortOrder: row.sort_order }
}

function annualExpensesFrom(settings: IndependenceSettings, irregularExpenses: IrregularExpense[]) {
  const annualCategoriesCzk = (
    settings.housingMonthlyCzk + settings.foodMonthlyCzk + settings.transportMonthlyCzk +
    settings.healthMonthlyCzk + settings.leisureMonthlyCzk + settings.clothingMonthlyCzk +
    settings.familyMonthlyCzk + settings.reserveMonthlyCzk
  ) * 12
  const annualIrregularCzk = irregularExpenses.reduce((sum, item) => sum + item.amountCzk / item.frequencyYears, 0)
  return Math.round(annualCategoriesCzk + annualIrregularCzk)
}

// Solves for the number of years until `startWealthCzk`, growing at `realReturnRate` per year
// with `annualContributionCzk` added each year, reaches `targetCzk`. Real (inflation-adjusted)
// terms throughout, so the target never needs to be inflated forward — see impl-plan.md §3.
function solveYearsToTarget(startWealthCzk: number, targetCzk: number, annualContributionCzk: number, realReturnRate: number): number | null {
  if (targetCzk <= 0 || startWealthCzk >= targetCzk) return 0
  if (annualContributionCzk <= 0 && realReturnRate <= 0) return null

  const maxYears = 100
  const valueAt = (years: number) => {
    if (realReturnRate === 0) return startWealthCzk + annualContributionCzk * years
    const growth = Math.pow(1 + realReturnRate, years)
    return startWealthCzk * growth + annualContributionCzk * ((growth - 1) / realReturnRate)
  }

  if (valueAt(maxYears) < targetCzk) return null

  let low = 0
  let high = maxYears
  for (let iteration = 0; iteration < 60; iteration++) {
    const mid = (low + high) / 2
    if (valueAt(mid) >= targetCzk) high = mid
    else low = mid
  }
  // Round up, not to nearest: an estimate of "years until independent" should never understate
  // how long it takes, so the reported horizon always actually clears the target.
  return Math.ceil(high * 10) / 10
}

const walletBalancesSql = `
  with prague_today as (
    select (now() at time zone 'Europe/Prague')::date as value
  ),
  transaction_deltas as (
    select
      t.wallet_id,
      sum(case when c.direction = 'income' then t.amount_czk else -t.amount_czk end) as delta_czk
    from transactions t
    join categories c on c.user_id = t.user_id and c.id = t.category_id
    join wallets w on w.user_id = t.user_id and w.id = t.wallet_id
    cross join prague_today today
    where t.user_id = $1
      and t.transaction_date >= w.opening_balance_date
      and t.transaction_date <= today.value
    group by t.wallet_id
  ),
  transfer_deltas as (
    select tr.source_wallet_id as wallet_id, -sum(tr.amount_czk) as delta_czk
    from transfers tr
    join wallets w on w.user_id = tr.user_id and w.id = tr.source_wallet_id
    cross join prague_today today
    where tr.user_id = $1
      and tr.transfer_date >= w.opening_balance_date
      and tr.transfer_date <= today.value
    group by tr.source_wallet_id

    union all

    select tr.destination_wallet_id as wallet_id, sum(tr.amount_czk) as delta_czk
    from transfers tr
    join wallets w on w.user_id = tr.user_id and w.id = tr.destination_wallet_id
    cross join prague_today today
    where tr.user_id = $1
      and tr.transfer_date >= w.opening_balance_date
      and tr.transfer_date <= today.value
    group by tr.destination_wallet_id
  ),
  adjustment_deltas as (
    select
      ba.wallet_id,
      sum(case when ba.operation = 'add' then ba.amount_czk else -ba.amount_czk end) as delta_czk
    from balance_adjustments ba
    join wallets w on w.user_id = ba.user_id and w.id = ba.wallet_id
    cross join prague_today today
    where ba.user_id = $1
      and ba.adjustment_date >= w.opening_balance_date
      and ba.adjustment_date <= today.value
    group by ba.wallet_id
  ),
  wallet_deltas as (
    select wallet_id, sum(delta_czk)::bigint as delta_czk
    from (
      select wallet_id, delta_czk from transaction_deltas
      union all
      select wallet_id, delta_czk from transfer_deltas
      union all
      select wallet_id, delta_czk from adjustment_deltas
    ) as all_deltas
    group by wallet_id
  ),
  wallet_balances as (
    select
      w.id,
      w.wallet_type,
      w.available_now,
      (w.opening_balance_czk + coalesce(wallet_deltas.delta_czk, 0))::bigint as current_balance_czk
    from wallets w
    left join wallet_deltas on wallet_deltas.wallet_id = w.id
    where w.user_id = $1 and w.counts_toward_independence
  )
  select wallet_type, available_now, current_balance_czk::text as current_balance_czk
  from wallet_balances
`

// Trailing 12 monthly buckets of total independence wealth (wallets flagged counts_toward_independence,
// regardless of available_now) — mirrors overview/repository.ts's wealthSeriesSql shape, scoped down.
const wealthSeriesSql = `
  with wallet_scope as (
    select id, opening_balance_czk, opening_balance_date
    from wallets
    where user_id = $1 and counts_toward_independence
  ),
  financial_events as materialized (
    select opening_balance_date as event_date, opening_balance_czk::bigint as delta_czk
    from wallet_scope
    union all
    select t.transaction_date, case c.direction when 'income' then t.amount_czk else -t.amount_czk end
    from transactions t
    join wallet_scope w on w.id = t.wallet_id
    join categories c on c.user_id = t.user_id and c.id = t.category_id
    where t.user_id = $1 and t.transaction_date >= w.opening_balance_date
    union all
    select tr.transfer_date, -tr.amount_czk
    from transfers tr
    join wallet_scope w on w.id = tr.source_wallet_id
    where tr.user_id = $1 and tr.transfer_date >= w.opening_balance_date
    union all
    select tr.transfer_date, tr.amount_czk
    from transfers tr
    join wallet_scope w on w.id = tr.destination_wallet_id
    where tr.user_id = $1 and tr.transfer_date >= w.opening_balance_date
    union all
    select adjustment_date, case operation when 'add' then amount_czk else -amount_czk end
    from balance_adjustments adjustment
    join wallet_scope w on w.id = adjustment.wallet_id
    where adjustment.user_id = $1 and adjustment.adjustment_date >= w.opening_balance_date
  ),
  bounds as (
    select date_trunc('month', (now() at time zone 'Europe/Prague')::date)::date as this_month
  ),
  base as (
    select coalesce(sum(delta_czk) filter (where event_date < (select this_month - interval '11 months' from bounds)), 0)::bigint as amount_czk
    from financial_events
  ),
  buckets as (
    select bucket_start::date
    from bounds, generate_series((select this_month - interval '11 months' from bounds), (select this_month from bounds), interval '1 month') bucket_start
  ),
  bucket_deltas as (
    select date_trunc('month', event_date)::date as bucket_start, sum(delta_czk)::bigint as delta_czk
    from financial_events
    where event_date >= (select this_month - interval '11 months' from bounds)
    group by 1
  )
  select to_char(b.bucket_start, 'YYYY-MM-DD') as bucket_date,
    (base.amount_czk + sum(coalesce(d.delta_czk, 0)) over (order by b.bucket_start rows unbounded preceding))::text as amount_czk
  from buckets b
  cross join base
  left join bucket_deltas d on d.bucket_start = b.bucket_start
  order by b.bucket_start asc
`

export function createIndependenceRepository(pool: Pool): IndependenceRepository {
  return {
    async getSettings(userId) {
      const result = await pool.query<SettingsRow>('select * from independence_settings where user_id = $1', [userId])
      return result.rows[0] ? toSettings(result.rows[0]) : null
    },

    async upsertSettings(userId, input) {
      const result = await pool.query<SettingsRow>(
        `insert into independence_settings (
           user_id, withdrawal_rate_percent, expected_real_return_percent, inflation_rate_percent, monthly_contribution_czk,
           housing_monthly_czk, food_monthly_czk, transport_monthly_czk, health_monthly_czk,
           leisure_monthly_czk, clothing_monthly_czk, family_monthly_czk, reserve_monthly_czk
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         on conflict (user_id) do update set
           withdrawal_rate_percent = excluded.withdrawal_rate_percent,
           expected_real_return_percent = excluded.expected_real_return_percent,
           inflation_rate_percent = excluded.inflation_rate_percent,
           monthly_contribution_czk = excluded.monthly_contribution_czk,
           housing_monthly_czk = excluded.housing_monthly_czk,
           food_monthly_czk = excluded.food_monthly_czk,
           transport_monthly_czk = excluded.transport_monthly_czk,
           health_monthly_czk = excluded.health_monthly_czk,
           leisure_monthly_czk = excluded.leisure_monthly_czk,
           clothing_monthly_czk = excluded.clothing_monthly_czk,
           family_monthly_czk = excluded.family_monthly_czk,
           reserve_monthly_czk = excluded.reserve_monthly_czk
         returning *`,
        [
          userId, input.withdrawalRatePercent, input.expectedRealReturnPercent, input.inflationRatePercent, input.monthlyContributionCzk,
          input.housingMonthlyCzk, input.foodMonthlyCzk, input.transportMonthlyCzk, input.healthMonthlyCzk,
          input.leisureMonthlyCzk, input.clothingMonthlyCzk, input.familyMonthlyCzk, input.reserveMonthlyCzk,
        ],
      )
      return toSettings(result.rows[0])
    },

    async listIrregularExpenses(userId) {
      const result = await pool.query<IrregularExpenseRow>(
        'select id, name, amount_czk, frequency_years, sort_order from independence_irregular_expenses where user_id = $1 order by sort_order asc, created_at asc',
        [userId],
      )
      return result.rows.map(toIrregularExpense)
    },

    async createIrregularExpense(userId, input) {
      const result = await pool.query<IrregularExpenseRow>(
        `with next_order as (
           select coalesce(max(sort_order) + 1, 0) as sort_order
           from independence_irregular_expenses
           where user_id = $1
         )
         insert into independence_irregular_expenses (user_id, name, amount_czk, frequency_years, sort_order)
         select $1, $2, $3, $4, next_order.sort_order
         from next_order
         returning id, name, amount_czk, frequency_years, sort_order`,
        [userId, input.name, input.amountCzk, input.frequencyYears],
      )
      return toIrregularExpense(result.rows[0])
    },

    async updateIrregularExpense(userId, id, input) {
      const assignments: string[] = []
      const values: unknown[] = [userId, id]
      const add = (column: string, value: unknown) => {
        values.push(value)
        assignments.push(`${column} = $${values.length}`)
      }

      if (input.name !== undefined) add('name', input.name)
      if (input.amountCzk !== undefined) add('amount_czk', input.amountCzk)
      if (input.frequencyYears !== undefined) add('frequency_years', input.frequencyYears)

      if (assignments.length === 0) throw new DomainError(400, 'Chybí změna položky.')

      const result = await pool.query<IrregularExpenseRow>(
        `update independence_irregular_expenses
         set ${assignments.join(', ')}
         where user_id = $1 and id = $2
         returning id, name, amount_czk, frequency_years, sort_order`,
        values,
      )
      return result.rows[0] ? toIrregularExpense(result.rows[0]) : null
    },

    async deleteIrregularExpense(userId, id) {
      const result = await pool.query('delete from independence_irregular_expenses where user_id = $1 and id = $2', [userId, id])
      return (result.rowCount ?? 0) > 0
    },

    async getProgress(userId) {
      const [settingsResult, irregularExpenses, walletBalancesResult] = await Promise.all([
        pool.query<SettingsRow>('select * from independence_settings where user_id = $1', [userId]),
        this.listIrregularExpenses(userId),
        withWealthCache(`independence:wallet-balances:${userId}`, () => pool.query<WalletBalanceRow>(walletBalancesSql, [userId])),
      ])

      const settings = settingsResult.rows[0] ? toSettings(settingsResult.rows[0]) : null
      const balances = walletBalancesResult.rows
      const totalWealthCzk = balances.reduce((sum, row) => sum + Number(row.current_balance_czk), 0)
      const availableWealthCzk = balances.filter((row) => row.available_now).reduce((sum, row) => sum + Number(row.current_balance_czk), 0)
      const wealthByType = toWealthByType(balances)

      if (!settings) {
        return {
          hasSettings: false,
          annualExpensesCzk: 0,
          independenceNumberCzk: 0,
          totalWealthCzk,
          availableWealthCzk,
          totalProgressPercent: 0,
          availableProgressPercent: 0,
          yearsToTotal: null,
          yearsToAvailable: null,
          futureAnnualExpensesCzk: null,
          wealthByType,
          returnSensitivity: [],
        }
      }

      const annualExpensesCzk = annualExpensesFrom(settings, irregularExpenses)
      const independenceNumberCzk = Math.round(annualExpensesCzk * (100 / settings.withdrawalRatePercent))
      const totalProgressPercent = independenceNumberCzk > 0 ? (totalWealthCzk / independenceNumberCzk) * 100 : 0
      const availableProgressPercent = independenceNumberCzk > 0 ? (availableWealthCzk / independenceNumberCzk) * 100 : 0

      const annualContributionCzk = settings.monthlyContributionCzk * 12
      const yearsToTotal = solveYearsToTarget(totalWealthCzk, independenceNumberCzk, annualContributionCzk, settings.expectedRealReturnPercent / 100)
      const yearsToAvailable = solveYearsToTarget(availableWealthCzk, independenceNumberCzk, annualContributionCzk, settings.expectedRealReturnPercent / 100)
      const futureAnnualExpensesCzk = yearsToAvailable !== null
        ? Math.round(annualExpensesCzk * Math.pow(1 + settings.inflationRatePercent / 100, yearsToAvailable))
        : null
      const returnSensitivity = sensitivityRatesIncluding(settings.expectedRealReturnPercent).map((realReturnPercent) => ({
        realReturnPercent,
        yearsToTotal: solveYearsToTarget(totalWealthCzk, independenceNumberCzk, annualContributionCzk, realReturnPercent / 100),
        yearsToAvailable: solveYearsToTarget(availableWealthCzk, independenceNumberCzk, annualContributionCzk, realReturnPercent / 100),
      }))

      return {
        hasSettings: true,
        annualExpensesCzk,
        independenceNumberCzk,
        totalWealthCzk,
        availableWealthCzk,
        totalProgressPercent,
        availableProgressPercent,
        yearsToTotal,
        yearsToAvailable,
        futureAnnualExpensesCzk,
        wealthByType,
        returnSensitivity,
      }
    },

    async getWealthSeries(userId) {
      const result = await withWealthCache(`independence:wealth-series:${userId}`, () => pool.query<{ bucket_date: string; amount_czk: string }>(wealthSeriesSql, [userId]))
      return result.rows.map((row) => ({ date: row.bucket_date, amountCzk: Number(row.amount_czk) }))
    },
  }
}
