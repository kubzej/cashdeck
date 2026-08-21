import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { CircleAlert, Landmark, Tags, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Skeleton } from '../../components/ui/skeleton'
import { formatCzk } from '../../lib/format-czk'
import { parseIsoDate } from '../../lib/prague-date'
import type { CategoryColorKey, CategoryIconKey } from '../categories/api'
import { CategoryIcon } from '../categories/category-icon'
import { resolveFeedDateRange, type FeedFilterValue } from '../feed/feed-filters'
import { getOverview, getOverviewSelectionTrend, type OverviewGranularity, type OverviewMetrics, type OverviewSelectionTrend } from '../overview/api'
import type { OverviewSelection } from '../overview/overview-screen'

export function SelectionSummaryCard({ filters, selection }: { filters: FeedFilterValue; selection: OverviewSelection }) {
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
    void getOverview({ walletIds: filters.walletIds, period: filters.period, dateFrom: range.dateFrom, dateTo: range.dateTo, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setMetrics(result); setStatus('ready') } })
      .catch((error: unknown) => { if (!controller.signal.aborted && !isAbortError(error)) setStatus('error') })
    return () => controller.abort()
  }, [walletKey, filters.period, range.dateFrom, range.dateTo, selection.type, selection.id, retryKey])

  useEffect(() => {
    if (!metrics) return
    const controller = new AbortController()
    void getOverviewSelectionTrend({ type: selection.type, id: selection.id, walletIds: filters.walletIds, dateFrom: metrics.range.dateFrom, dateTo: metrics.range.dateTo, granularity: metrics.range.granularity, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setTrend(result) })
      .catch(() => { /* the chart and trend pill are a best-effort enhancement; the headline amount above already loaded */ })
    return () => controller.abort()
  }, [metrics, walletKey, selection.type, selection.id])

  if (status === 'loading') return <div className="selection-summary selection-summary--loading" aria-label="Načítání přehledu výběru"><Skeleton className="h-10 w-10" /><div><Skeleton className="h-4 w-28" /><Skeleton className="mt-1 h-3 w-20" /></div></div>
  if (status === 'error') return <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Přehled se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={() => setRetryKey((current) => current + 1)}>Zkusit znovu</Button></FeedbackStateActions></FeedbackState>

  if (selection.type === 'category') {
    const category = metrics?.categories.find((item) => item.id === selection.id)
    const amountCzk = category ? (category.direction === 'income' ? category.amountCzk : -category.amountCzk) : 0
    return <SummaryCard
      icon={category ? <CategoryIcon iconKey={category.iconKey as CategoryIconKey} colorKey={category.colorKey as CategoryColorKey} /> : <Landmark aria-hidden="true" />}
      colorKey={category?.colorKey}
      title="Kategorie"
      name={selection.name}
      meta={formatTransactionCount(category?.transactionCount ?? 0)}
      amountCzk={amountCzk}
      trend={trend}
      granularity={metrics?.range.granularity ?? 'day'}
    />
  }

  const label = metrics?.labels.find((item) => item.id === selection.id)
  // Transfers tagged with a label are neutral to its money total, matching Přehled's
  // "Celkem" mode — a label's amount reflects income/expense attribution only.
  const amountCzk = label ? label.incomeCzk - label.expenseCzk : 0
  const count = (label?.transactionCount ?? 0) + (label?.transferCount ?? 0)
  return <SummaryCard icon={<Tags aria-hidden="true" />} title="Štítek" name={selection.name} meta={formatItemCount(count)} amountCzk={amountCzk} trend={trend} granularity={metrics?.range.granularity ?? 'day'} />
}

function SummaryCard({ icon, colorKey, title, name, meta, amountCzk, trend, granularity }: { icon: ReactNode; colorKey?: string; title: string; name: string; meta: string; amountCzk: number; trend: OverviewSelectionTrend | null; granularity: OverviewGranularity }) {
  const delta = trend ? getTrendDelta(amountCzk, trend.previous.amountCzk) : null
  return <div className="selection-summary">
    <div className="selection-summary__header">
      <span className={`selection-summary__icon ${colorKey ? `color-key--${colorKey}` : ''}`.trim()}>{icon}</span>
      <span className="selection-summary__kicker">{title}</span>
      <strong className="selection-summary__name">{name}</strong>
    </div>
    <div className="selection-summary__headline">
      <strong className={amountCzk < 0 ? 'selection-summary__amount selection-summary__amount--expense' : 'selection-summary__amount'}>{formatCzk(amountCzk, { signed: true })}</strong>
      {delta ? <TrendPill delta={delta} /> : null}
    </div>
    <small className="selection-summary__meta">{meta}</small>
    {trend && trend.series.length > 1 ? <Sparkline points={trend.series} granularity={granularity} /> : null}
  </div>
}

function TrendPill({ delta }: { delta: TrendDelta }) {
  return <span className={`selection-summary__trend selection-summary__trend--${delta.tone}`}>
    {delta.tone === 'positive' ? <TrendingUp aria-hidden="true" /> : delta.tone === 'negative' ? <TrendingDown aria-hidden="true" /> : null}
    {delta.label}
  </span>
}

function Sparkline({ points, granularity }: { points: OverviewSelectionTrend['series']; granularity: OverviewGranularity }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const max = Math.max(...points.map((point) => Math.abs(point.amountCzk)), 1)
  const activePoint = activeIndex === null ? null : points[activeIndex]

  return <div className="selection-summary__sparkline-wrap">
    {activePoint && activeIndex !== null ? <div className="selection-summary__sparkline-tooltip" style={{ left: `${(activeIndex + 0.5) / points.length * 100}%` } as CSSProperties}>
      <span>{formatBucketDate(activePoint.date, granularity)}</span>
      <strong>{formatCzk(activePoint.amountCzk, { signed: true })}</strong>
    </div> : null}
    <div className="selection-summary__sparkline">
      {points.map((point, index) => <button
        type="button"
        key={point.date}
        className={point.amountCzk < 0 ? 'is-negative' : point.amountCzk > 0 ? 'is-positive' : 'is-neutral'}
        aria-label={`${formatBucketDate(point.date, granularity)}: ${formatCzk(point.amountCzk, { signed: true })}`}
        aria-pressed={activeIndex === index}
        onClick={() => setActiveIndex((current) => current === index ? null : index)}
      >
        <i style={{ '--bar-size': `${point.amountCzk === 0 ? 4 : Math.max(8, Math.abs(point.amountCzk) / max * 100)}%` } as CSSProperties} />
      </button>)}
    </div>
  </div>
}

function formatBucketDate(value: string, granularity: OverviewGranularity) {
  const date = parseIsoDate(value)
  if (granularity === 'day') return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  if (granularity === 'month') return new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(date)
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
}

type TrendDelta = { tone: 'positive' | 'negative' | 'neutral'; label: string }

function getTrendDelta(currentCzk: number, previousCzk: number): TrendDelta {
  // With no previous-period activity there's nothing to compare against — a percentage would be
  // undefined and the raw delta would just repeat the headline amount, so show neither.
  if (previousCzk === 0) return { tone: 'neutral', label: currentCzk === 0 ? 'beze změny' : 'bez srovnání' }
  const delta = currentCzk - previousCzk
  if (delta === 0) return { tone: 'neutral', label: 'beze změny' }
  const tone = delta > 0 ? 'positive' : 'negative'
  const percent = Math.round(Math.abs(delta) / Math.abs(previousCzk) * 100)
  return { tone, label: `${delta > 0 ? '+' : '-'}${percent} %` }
}

function formatTransactionCount(count: number) { return `${count} ${count === 1 ? 'transakce' : count >= 2 && count <= 4 ? 'transakce' : 'transakcí'}` }
function formatItemCount(count: number) { return `${count} ${count === 1 ? 'položka' : count >= 2 && count <= 4 ? 'položky' : 'položek'}` }

function isAbortError(error: unknown) { return error instanceof DOMException && error.name === 'AbortError' }
