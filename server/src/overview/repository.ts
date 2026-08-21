import type { Pool } from 'pg'
import { getPragueToday } from '../recurring/schedule.js'
import { resolveOverviewGranularity, type OverviewGranularity, type OverviewInput } from './domain.js'

export type OverviewCategory = {
  id: string
  name: string
  iconKey: string
  colorKey: string
  direction: 'income' | 'expense'
  amountCzk: number
  transactionCount: number
}

export type OverviewLabel = {
  id: string
  name: string
  incomeCzk: number
  expenseCzk: number
  transactionCount: number
  transferImpactCzk: number
  transferCount: number
}

export type OverviewSeriesPoint = { date: string; valueCzk: number }
export type OverviewFlowPoint = { date: string; incomeCzk: number; expenseCzk: number }

export type OverviewMetrics = {
  range: { dateFrom: string; dateTo: string; earliestActivityDate: string | null; granularity: OverviewGranularity }
  wealth: { amountCzk: number; changeCzk: number }
  flow: { incomeCzk: number; expenseCzk: number; cashflowCzk: number }
  wealthSeries: OverviewSeriesPoint[]
  flowSeries: OverviewFlowPoint[]
  categories: OverviewCategory[]
  labels: OverviewLabel[]
}

export type OverviewRepository = { getOverview(userId: string, input: OverviewInput): Promise<OverviewMetrics> }

type BoundsRow = { earliest_activity_date: string | null }
type WealthRow = { wealth_czk: string; change_czk: string }
type FlowRow = { income_czk: string; expense_czk: string }
type SeriesRow = { bucket_date: string; value_czk: string }
type FlowSeriesRow = { bucket_date: string; income_czk: string; expense_czk: string }
type CategoryRow = { id: string; name: string; icon_key: string; color_key: string; direction: 'income' | 'expense'; amount_czk: string; transaction_count: string }
type LabelRow = { id: string; name: string; income_czk: string; expense_czk: string; transaction_count: string; transfer_impact_czk: string; transfer_count: string }
export function createOverviewRepository(pool: Pool): OverviewRepository {
  return {
    async getOverview(userId, input) {
      const today = getPragueToday()
      const bounds = await pool.query<BoundsRow>(boundsSql(), [userId, input.walletIds, today])
      const earliestActivityDate = bounds.rows[0]?.earliest_activity_date ?? null
      const dateFrom = clampToToday(input.dateFrom ?? earliestActivityDate ?? today, today)
      const dateTo = clampToToday(input.dateTo ?? today, today)
      const granularity = resolveOverviewGranularity(input.period, dateFrom, dateTo)
      const parameters: unknown[] = [userId, input.walletIds, dateFrom, dateTo]

      const [wealthResult, flowResult, wealthSeriesResult, flowSeriesResult, categoryResult, labelResult] = await Promise.all([
        pool.query<WealthRow>(wealthSql(), parameters),
        pool.query<FlowRow>(flowSql(), parameters),
        pool.query<SeriesRow>(wealthSeriesSql(granularity), parameters),
        pool.query<FlowSeriesRow>(flowSeriesSql(granularity), parameters),
        pool.query<CategoryRow>(categoriesSql(), parameters),
        pool.query<LabelRow>(labelsSql(), parameters),
      ])

      const wealth = wealthResult.rows[0] ?? { wealth_czk: '0', change_czk: '0' }
      const flow = flowResult.rows[0] ?? { income_czk: '0', expense_czk: '0' }
      const incomeCzk = Number(flow.income_czk)
      const expenseCzk = Number(flow.expense_czk)

      const metrics: OverviewMetrics = {
        range: { dateFrom, dateTo, earliestActivityDate, granularity },
        wealth: { amountCzk: Number(wealth.wealth_czk), changeCzk: Number(wealth.change_czk) },
        flow: { incomeCzk, expenseCzk, cashflowCzk: incomeCzk - expenseCzk },
        wealthSeries: wealthSeriesResult.rows.map((row) => ({ date: row.bucket_date, valueCzk: Number(row.value_czk) })),
        flowSeries: flowSeriesResult.rows.map((row) => ({ date: row.bucket_date, incomeCzk: Number(row.income_czk), expenseCzk: Number(row.expense_czk) })),
        categories: categoryResult.rows.map((row) => ({ id: row.id, name: row.name, iconKey: row.icon_key, colorKey: row.color_key, direction: row.direction, amountCzk: Number(row.amount_czk), transactionCount: Number(row.transaction_count) })),
        labels: labelResult.rows.map((row) => ({
          id: row.id,
          name: row.name,
          incomeCzk: Number(row.income_czk),
          expenseCzk: Number(row.expense_czk),
          transactionCount: Number(row.transaction_count),
          transferImpactCzk: Number(row.transfer_impact_czk),
          transferCount: Number(row.transfer_count),
        })),
      }
      return metrics
    },
  }
}

function clampToToday(value: string, today: string) {
  return value > today ? today : value
}

function walletScope() {
  return `wallet_scope as (
    select id, opening_balance_czk, opening_balance_date
    from wallets
    where user_id = $1
      and not is_hidden
      and ($2::uuid[] is null or id = any($2::uuid[]))
  )`
}

function financialEvents() {
  return `${walletScope()}, financial_events as (
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
  )`
}

function boundsSql() {
  return `with ${financialEvents()}
    select to_char(min(event_date), 'YYYY-MM-DD') as earliest_activity_date
    from financial_events
    where event_date <= $3::date`
}

function wealthSql() {
  return `with ${financialEvents()}
    select
      coalesce(sum(delta_czk) filter (where event_date <= $4::date), 0)::text as wealth_czk,
      coalesce(sum(delta_czk) filter (where event_date >= $3::date and event_date <= $4::date), 0)::text as change_czk
    from financial_events`
}

function transactionScope() {
  return `with ${walletScope()}, filtered_transactions as (
    select t.id, t.amount_czk, t.transaction_date, t.category_id
    from transactions t
    join wallet_scope w on w.id = t.wallet_id
    where t.user_id = $1
      and t.transaction_date >= w.opening_balance_date
      and t.transaction_date between $3::date and $4::date
  )`
}

function flowSql() {
  return `${transactionScope()}
    select
      coalesce(sum(t.amount_czk) filter (where c.direction = 'income'), 0)::text as income_czk,
      coalesce(sum(t.amount_czk) filter (where c.direction = 'expense'), 0)::text as expense_czk
    from filtered_transactions t
    join categories c on c.user_id = $1 and c.id = t.category_id`
}

function wealthSeriesSql(granularity: OverviewGranularity) {
  const interval = granularity === 'day' ? "interval '1 day'" : granularity === 'month' ? "interval '1 month'" : "interval '3 months'"
  const truncation = granularity === 'day' ? 'day' : granularity === 'month' ? 'month' : 'quarter'
  return `with ${financialEvents()},
    base as (
      select coalesce(sum(delta_czk) filter (where event_date < $3::date), 0)::bigint as amount_czk
      from financial_events
    ),
    buckets as (
      select bucket_start::date
      from generate_series(date_trunc('${truncation}', $3::date)::date, date_trunc('${truncation}', $4::date)::date, ${interval}) bucket_start
    ),
    bucket_deltas as (
      select date_trunc('${truncation}', event_date)::date as bucket_start, sum(delta_czk)::bigint as delta_czk
      from financial_events
      where event_date between $3::date and $4::date
      group by 1
    )
    select to_char(b.bucket_start, 'YYYY-MM-DD') as bucket_date,
      (base.amount_czk + sum(coalesce(d.delta_czk, 0)) over (order by b.bucket_start rows unbounded preceding))::text as value_czk
    from buckets b
    cross join base
    left join bucket_deltas d on d.bucket_start = b.bucket_start
    order by b.bucket_start asc`
}

function flowSeriesSql(granularity: OverviewGranularity) {
  const truncation = granularity === 'day' ? 'day' : granularity === 'month' ? 'month' : 'quarter'
  return `${transactionScope()}
    select to_char(date_trunc('${truncation}', t.transaction_date)::date, 'YYYY-MM-DD') as bucket_date,
      coalesce(sum(t.amount_czk) filter (where c.direction = 'income'), 0)::text as income_czk,
      coalesce(sum(t.amount_czk) filter (where c.direction = 'expense'), 0)::text as expense_czk
    from filtered_transactions t
    join categories c on c.user_id = $1 and c.id = t.category_id
    group by 1
    order by 1 asc`
}

function categoriesSql() {
  return `${transactionScope()}
    select c.id, c.name, c.icon_key, c.color_key, c.direction,
      sum(t.amount_czk)::text as amount_czk,
      count(*)::text as transaction_count
    from filtered_transactions t
    join categories c on c.user_id = $1 and c.id = t.category_id
    group by c.id, c.name, c.icon_key, c.color_key, c.direction
    order by sum(t.amount_czk) desc, c.name asc`
}

function labelsSql() {
  return `with ${walletScope()},
    filtered_transactions as (
      select t.id, t.amount_czk, t.category_id
      from transactions t
      join wallet_scope w on w.id = t.wallet_id
      where t.user_id = $1
        and t.transaction_date >= w.opening_balance_date
        and t.transaction_date between $3::date and $4::date
    ),
    transaction_label_totals as (
      select l.id, l.name,
        coalesce(sum(t.amount_czk) filter (where c.direction = 'income'), 0)::bigint as income_czk,
        coalesce(sum(t.amount_czk) filter (where c.direction = 'expense'), 0)::bigint as expense_czk,
        count(distinct t.id)::bigint as transaction_count,
        0::bigint as transfer_impact_czk,
        0::bigint as transfer_count
      from filtered_transactions t
      join categories c on c.user_id = $1 and c.id = t.category_id
      join transaction_labels tl on tl.user_id = $1 and tl.transaction_id = t.id
      join labels l on l.user_id = $1 and l.id = tl.label_id
      group by l.id, l.name
    ),
    transfer_label_totals as (
      select l.id, l.name,
        0::bigint as income_czk,
        0::bigint as expense_czk,
        0::bigint as transaction_count,
        coalesce(sum(
          case when $2::uuid[] is null then 0 else
            case when source_scope.id is not null then -tr.amount_czk else 0 end
            + case when destination_scope.id is not null then tr.amount_czk else 0 end
          end
        ), 0)::bigint as transfer_impact_czk,
        count(distinct tr.id)::bigint as transfer_count
      from transfers tr
      join wallets source_wallet on source_wallet.user_id = tr.user_id and source_wallet.id = tr.source_wallet_id and not source_wallet.is_hidden
      join wallets destination_wallet on destination_wallet.user_id = tr.user_id and destination_wallet.id = tr.destination_wallet_id and not destination_wallet.is_hidden
      left join wallet_scope source_scope on source_scope.id = tr.source_wallet_id
      left join wallet_scope destination_scope on destination_scope.id = tr.destination_wallet_id
      join transfer_labels tl on tl.user_id = $1 and tl.transfer_id = tr.id
      join labels l on l.user_id = $1 and l.id = tl.label_id
      where tr.user_id = $1
        and tr.transfer_date between $3::date and $4::date
        and ($2::uuid[] is null or source_scope.id is not null or destination_scope.id is not null)
      group by l.id, l.name
    ),
    label_totals as (
      select * from transaction_label_totals
      union all
      select * from transfer_label_totals
    )
    select id, name,
      sum(income_czk)::text as income_czk,
      sum(expense_czk)::text as expense_czk,
      sum(transaction_count)::text as transaction_count,
      sum(transfer_impact_czk)::text as transfer_impact_czk,
      sum(transfer_count)::text as transfer_count
    from label_totals
    group by id, name
    order by greatest(
      abs(sum(income_czk) - sum(expense_czk) + sum(transfer_impact_czk)),
      sum(income_czk),
      sum(expense_czk)
    ) desc, name asc`
}
