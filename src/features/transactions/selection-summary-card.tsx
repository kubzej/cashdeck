import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Landmark, Search, Tags, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { LoadError } from '../../components/load-error'
import { formatItemCount, formatTransactionCount } from '../../lib/format'
import { isAbortError } from '../../lib/api-client'
import { Card } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { formatCzk } from '../../lib/format-czk'
import { parseIsoDate } from '../../lib/prague-date'
import { CategoryIcon } from '../categories/category-icon'
import { resolveFeedDateRange, type FeedFilterValue } from '../feed/feed-filters'
import { getOverview, getOverviewSelectionTrend, type OverviewGranularity, type OverviewMetrics, type OverviewSelectionTrend } from '../overview/api'
import type { OverviewSelection } from '../overview/overview-screen'
import { getTrendDelta, type TrendDelta } from './trend-delta'

// `selection` is optional: without it, the card shows the running total for whatever the current
// filters (wallets, date range, and — like any other filter — search text) resolve to, instead of
// one specific category/label. `search` is the already-debounced value from the parent so this
// card and the transaction list below it settle on the same moment, not independently.
export function SelectionSummaryCard({ filters, selection, search }: { filters: FeedFilterValue; selection?: OverviewSelection; search: string }) {
  const range = resolveFeedDateRange(filters)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null)
  const [trend, setTrend] = useState<OverviewSelectionTrend | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const walletKey = filters.walletIds.join(',')

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setTrend(null)
    void getOverview({ walletIds: filters.walletIds, period: filters.period, dateFrom: range.dateFrom, dateTo: range.dateTo, search: search || undefined, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setMetrics(result); setStatus('ready') } })
      .catch((error: unknown) => { if (!controller.signal.aborted && !isAbortError(error)) setStatus('error') })
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the deps list the stable walletKey and date fields, not the walletIds array / range object that get a new identity on every render
  }, [walletKey, filters.period, range.dateFrom, range.dateTo, selection?.type, selection?.id, search, retryKey])

  useEffect(() => {
    if (!metrics) return
    const controller = new AbortController()
    // No category/label picked means 'total' — the same "everything in scope" trend the headline
    // total itself uses, so Celkem/Vyhledávání get a real comparison pill and graph too, not a
    // lesser version of what a category/label selection gets.
    void getOverviewSelectionTrend({ type: selection?.type ?? 'total', id: selection?.id, walletIds: filters.walletIds, dateFrom: metrics.range.dateFrom, dateTo: metrics.range.dateTo, granularity: metrics.range.granularity, search: search || undefined, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setTrend(result) })
      .catch(() => { /* the chart and trend pill are a best-effort enhancement; the headline amount above already loaded */ })
    return () => controller.abort()
    // walletKey/search are deliberately not deps here: every walletKey/search change already
    // forces a new `metrics` fetch above, and metrics always produces a new object reference —
    // so a metrics change alone is enough to trigger this effect with their current values.
    // Also depending on them directly would double-fire this request (once on their own change,
    // using the stale metrics still in state, and again once the new metrics lands).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, selection?.type, selection?.id])

  if (status === 'loading') return <Card aria-label="Načítání přehledu výběru" padding="none" className="selection-summary selection-summary--loading"><Skeleton className="h-10 w-10" /><div><Skeleton className="h-4 w-28" /><Skeleton className="mt-1 h-3 w-20" /></div></Card>
  if (status === 'error') return <LoadError title="Přehled se nepodařilo načíst" layout="inline" onRetry={() => setRetryKey((current) => current + 1)} />

  const series = trend?.series ?? []

  // With no category/label picked, search is itself the selection — same "type of filter, plus
  // its specific value" shape as Kategorie/Štítek below, including the real comparison pill and
  // graph (type 'total' on the backend — not a lesser, comparison-free version of this card).
  if (!selection) {
    const cashflowCzk = metrics?.flow.cashflowCzk ?? 0
    const delta = trend ? getTrendDelta(cashflowCzk, trend.previous.amountCzk) : null
    const transactionCount = metrics?.categories.reduce((sum, category) => sum + category.transactionCount, 0) ?? 0
    const meta = formatTransactionCount(transactionCount)
    return <SummaryCard
      icon={search ? <Search aria-hidden="true" /> : <Wallet aria-hidden="true" />}
      title={search ? 'Vyhledávání' : 'Celkem'}
      name={search ? `„${search}“` : undefined}
      meta={meta}
      amountCzk={cashflowCzk}
      delta={delta}
      series={series}
      granularity={metrics?.range.granularity ?? 'day'}
      period={filters.period}
    />
  }

  if (selection.type === 'category') {
    const category = metrics?.categories.find((item) => item.id === selection.id)
    const amountCzk = category ? (category.direction === 'income' ? category.amountCzk : -category.amountCzk) : 0
    const delta = trend ? getTrendDelta(amountCzk, trend.previous.amountCzk) : null
    return <SummaryCard
      icon={category ? <CategoryIcon iconKey={category.iconKey} colorKey={category.colorKey} /> : <Landmark aria-hidden="true" />}
      colorKey={category?.colorKey}
      title="Kategorie"
      name={selection.name}
      meta={formatTransactionCount(category?.transactionCount ?? 0)}
      amountCzk={amountCzk}
      delta={delta}
      series={series}
      granularity={metrics?.range.granularity ?? 'day'}
      period={filters.period}
    />
  }

  const label = metrics?.labels.find((item) => item.id === selection.id)
  // Transfers tagged with a label are neutral to its money total, matching Přehled's
  // "Celkem" mode — a label's amount reflects income/expense attribution only.
  const amountCzk = label ? label.incomeCzk - label.expenseCzk : 0
  const delta = trend ? getTrendDelta(amountCzk, trend.previous.amountCzk) : null
  const count = (label?.transactionCount ?? 0) + (label?.transferCount ?? 0)
  return <SummaryCard icon={<Tags aria-hidden="true" />} title="Štítek" name={selection.name} meta={formatItemCount(count)} amountCzk={amountCzk} delta={delta} series={series} granularity={metrics?.range.granularity ?? 'day'} period={filters.period} />
}

function SummaryCard({ icon, colorKey, title, name, meta, amountCzk, delta, series, granularity, period }: { icon: ReactNode; colorKey?: string; title: string; name?: string; meta: string; amountCzk: number; delta: TrendDelta | null; series: OverviewSelectionTrend['series']; granularity: OverviewGranularity; period: FeedFilterValue['period'] }) {
  return <Card padding="none" className="selection-summary">
    <div className="selection-summary__header">
      <span className={`selection-summary__icon ${colorKey ? `color-key--${colorKey}` : ''}`.trim()}>{icon}</span>
      <span className="selection-summary__kicker">{title}</span>
      {name ? <strong className="selection-summary__name">{name}</strong> : null}
    </div>
    <div className="selection-summary__headline">
      <strong className={amountCzk < 0 ? 'selection-summary__amount selection-summary__amount--expense' : 'selection-summary__amount'}>{formatCzk(amountCzk, { signed: true })}</strong>
      {delta ? <TrendNote delta={delta} period={period} /> : null}
    </div>
    <small className="selection-summary__meta">{meta}</small>
    {series.length > 1 ? <Sparkline points={series} granularity={granularity} /> : null}
  </Card>
}

const COMPARED_TO: Record<FeedFilterValue['period'], string> = {
  week: 'oproti minulému týdnu',
  month: 'oproti minulému měsíci',
  year: 'oproti minulému roku',
  all: 'oproti předchozímu období',
  custom: 'oproti předchozímu období',
}

function TrendNote({ delta, period }: { delta: TrendDelta; period: FeedFilterValue['period'] }) {
  const title = delta.comparable ? `${delta.label} ${COMPARED_TO[period]}` : delta.label
  return <span className={`selection-summary__trend selection-summary__trend--${delta.tone}`} title={title} aria-label={title}>
    {delta.tone === 'positive' ? <TrendingUp aria-hidden="true" /> : delta.tone === 'negative' ? <TrendingDown aria-hidden="true" /> : null}
    {delta.label}
  </span>
}

// Bars show each bucket's own amount; the hatched grey area behind them is the running total from
// the start of the period. Both share one zero line: income and a positive total rise above it,
// spending and a negative total hang below it. Each side is scaled on its own, so one large payday
// can't flatten the spending bars.
function Sparkline({ points, granularity }: { points: OverviewSelectionTrend['series']; granularity: OverviewGranularity }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const totals = points.reduce<number[]>((acc, point) => [...acc, (acc[acc.length - 1] ?? 0) + point.amountCzk], [])
  const maxIncome = Math.max(...points.map((point) => point.amountCzk), 0)
  const maxExpense = Math.max(...points.map((point) => -point.amountCzk), 0)
  const top = Math.max(...totals, 0)
  const bottom = Math.min(...totals, 0)
  const hasAbove = top > 0 || maxIncome > 0
  const hasBelow = bottom < 0 || maxExpense > 0
  // Share of the chart height above the zero line.
  const zero = hasAbove && hasBelow ? Math.min(Math.max(top / ((top - bottom) || 1), 0.3), 0.7) : hasAbove ? 0.85 : hasBelow ? 0.15 : 0.5
  const toX = (index: number) => (index + 0.5) / points.length * 100
  const toY = (value: number) => (value >= 0 ? zero * (1 - value / (top || 1)) : zero + (1 - zero) * (value / (bottom || -1))) * 100
  const line = totals.map((value, index) => `${toX(index).toFixed(2)}% ${toY(value).toFixed(2)}%`)
  const area = `polygon(${line.join(', ')}, ${toX(points.length - 1).toFixed(2)}% ${toY(0).toFixed(2)}%, ${toX(0).toFixed(2)}% ${toY(0).toFixed(2)}%)`
  const barStyle = (amountCzk: number): CSSProperties => amountCzk >= 0
    ? { bottom: `${(1 - zero) * 100}%`, height: `${amountCzk === 0 ? 0 : Math.max(0.08, amountCzk / (maxIncome || 1)) * zero * 100}%` }
    : { top: `${zero * 100}%`, height: `${Math.max(0.08, -amountCzk / (maxExpense || 1)) * (1 - zero) * 100}%` }
  const activePoint = activeIndex === null ? null : points[activeIndex]

  return <div className="selection-summary__sparkline-wrap">
    {activePoint && activeIndex !== null ? <div className="selection-summary__sparkline-tooltip" style={{ left: `${clampTooltipLeftPercent(toX(activeIndex))}%` } as CSSProperties}>
      <span>{formatBucketDate(activePoint.date, granularity)}</span>
      <strong>{formatCzk(activePoint.amountCzk, { signed: true })}</strong>
      <span>Celkem {formatCzk(totals[activeIndex], { signed: true })}</span>
    </div> : null}
    <div className="selection-summary__sparkline">
      <div className="selection-summary__sparkline-total" style={{ clipPath: area } as CSSProperties} aria-hidden="true" />
      <div className="selection-summary__sparkline-zero" style={{ top: `${zero * 100}%` } as CSSProperties} aria-hidden="true" />
      {points.map((point, index) => <button
        type="button"
        key={point.date}
        className={point.amountCzk < 0 ? 'is-negative' : point.amountCzk > 0 ? 'is-positive' : 'is-neutral'}
        aria-label={`${formatBucketDate(point.date, granularity)}: ${formatCzk(point.amountCzk, { signed: true })}, celkem ${formatCzk(totals[index], { signed: true })}`}
        aria-pressed={activeIndex === index}
        onClick={() => setActiveIndex((current) => current === index ? null : index)}
      >
        <i style={barStyle(point.amountCzk)} />
      </button>)}
    </div>
  </div>
}

// The tooltip is centered on its bar via `translateX(-50%)`, so for a bar near either edge of the
// card (e.g. the most recent day, tapped constantly) it would overflow the card horizontally —
// which briefly overflows the whole page on mobile Safari and visibly shifts the fixed bottom
// nav. Clamping keeps the tooltip's anchor point far enough from 0%/100% that its own width
// (min-width: 6.5rem, card content is roughly 300-340px wide) never crosses the card's edge.
function clampTooltipLeftPercent(rawPercent: number) {
  return Math.min(Math.max(rawPercent, 18), 82)
}

function formatBucketDate(value: string, granularity: OverviewGranularity) {
  const date = parseIsoDate(value)
  if (granularity === 'day') return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  if (granularity === 'month') return new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(date)
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
}


