import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { BarChart3, CircleAlert, Landmark, RefreshCw, Tags } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Skeleton } from '../../components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { CategoryIcon } from '../categories/category-icon'
import type { CategoryColorKey, CategoryIconKey } from '../categories/api'
import { createDefaultFeedFilters, FeedFilters, isNavigablePeriod, resolveFeedDateRange, type FeedFilterValue } from '../feed/feed-filters'
import { FeedPeriodPager } from '../feed/feed-period-pager'
import { listWallets, type Wallet } from '../wallets/api'
import { getOverview, type OverviewCategory, type OverviewLabel, type OverviewMetrics } from './api'
import './overview.css'

type OverviewMode = 'total' | 'income' | 'expense' | 'cashflow'
export type OverviewSelection = { type: 'category' | 'label'; id: string; name: string }

export function OverviewScreen({ onOpenTransactions }: { onOpenTransactions: (filters: FeedFilterValue, selection: OverviewSelection) => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null)
  const [filters, setFilters] = useState<FeedFilterValue>(createDefaultFeedFilters)
  const [mode, setMode] = useState<OverviewMode>('total')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void listWallets().then((result) => {
      if (!controller.signal.aborted) setWallets(result.items)
    }).catch(() => {
      if (!controller.signal.aborted) setWallets([])
    })
    return () => controller.abort()
  }, [])

  const range = resolveFeedDateRange(filters)
  const walletFilterKey = filters.walletIds.join(',')
  const requestKey = JSON.stringify({ walletFilterKey, period: filters.period, periodAnchor: filters.periodAnchor, ...range, reloadToken })

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    void getOverview({ walletIds: filters.walletIds, period: filters.period, ...range, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      setMetrics(result)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted || isAbortError(error)) return
      setStatus('error')
    })
    return () => controller.abort()
  }, [requestKey])

  function setOverviewFilters(next: FeedFilterValue) {
    setFilters((current) => ({ ...next, search: current.search }))
  }

  const content = status === 'loading' ? <OverviewSkeleton />
    : status === 'error' ? <FeedbackState status="error" layout="panel" className="overview-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Přehled se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={() => setReloadToken((current) => current + 1)}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
      : metrics ? <OverviewContent metrics={metrics} mode={mode} onModeChange={setMode} onOpenTransactions={(selection) => onOpenTransactions(filters, selection)} />
        : null

  return <section className="overview-screen" aria-label="Přehled financí">
    <FeedFilters wallets={wallets} value={filters} onChange={setOverviewFilters} showSearch={false} ariaLabel="Filtry přehledu" />
    {isNavigablePeriod(filters.period) ? <FeedPeriodPager period={filters.period} periodAnchor={filters.periodAnchor} earliestActivityDate={metrics?.range.earliestActivityDate ?? null} onNavigate={(periodAnchor) => setFilters((current) => ({ ...current, periodAnchor }))}>{content}</FeedPeriodPager> : content}
  </section>
}

function OverviewContent({ metrics, mode, onModeChange, onOpenTransactions }: { metrics: OverviewMetrics; mode: OverviewMode; onModeChange: (mode: OverviewMode) => void; onOpenTransactions: (selection: OverviewSelection) => void }) {
  const primary = getPrimaryMetric(metrics, mode)
  const categories = metrics.categories.filter((category) => mode === 'income' ? category.direction === 'income' : mode === 'expense' ? category.direction === 'expense' : true)
  const labels = metrics.labels.map((label) => getLabelDisplay(label, mode)).filter((label) => label.magnitudeCzk > 0)
  const categoryTitle = mode === 'income' ? 'Kategorie příjmů' : mode === 'expense' ? 'Kategorie výdajů' : 'Kategorie'
  const labelTitle = mode === 'income' ? 'Štítky příjmů' : mode === 'expense' ? 'Štítky výdajů' : 'Štítky'

  return <div className="overview-content">
    <ToggleGroup type="single" value={mode} onValueChange={(value) => { if (isOverviewMode(value)) onModeChange(value) }} width="full" className="overview-mode" aria-label="Typ přehledu">
      <ToggleGroupItem value="total">Celkem</ToggleGroupItem>
      <ToggleGroupItem value="income">Příjmy</ToggleGroupItem>
      <ToggleGroupItem value="expense">Výdaje</ToggleGroupItem>
      <ToggleGroupItem value="cashflow">Cashflow</ToggleGroupItem>
    </ToggleGroup>

    <section className="overview-hero" aria-label={primary.label}>
      <strong className={`overview-hero__amount overview-hero__amount--${primary.tone}`}>{formatSignedMoney(primary.amountCzk, primary.signed)}</strong>
      <span>{primary.label}</span>
    </section>

    <section className="overview-chart-section" aria-labelledby="overview-chart-title">
      <div className="overview-section-heading"><div><h2 id="overview-chart-title">{mode === 'total' ? 'Vývoj bohatství' : 'Tok peněz'}</h2><p>{formatRange(metrics.range.dateFrom, metrics.range.dateTo)}</p></div></div>
      {mode === 'total' ? <WealthChart points={metrics.wealthSeries} /> : <FlowChart points={metrics.flowSeries} mode={mode} />}
    </section>

    <BreakdownSection title={categoryTitle} emptyText="V tomto období nejsou žádné kategorie." icon={<Landmark aria-hidden="true" />}>
      {categories.length ? <CategoryBreakdown categories={categories} mode={mode} onOpenTransactions={onOpenTransactions} /> : null}
    </BreakdownSection>

    <BreakdownSection title={labelTitle} emptyText="V tomto období nejsou žádné štítky." icon={<Tags aria-hidden="true" />}>
      {labels.length ? <LabelBreakdown labels={labels} onOpenTransactions={onOpenTransactions} /> : null}
    </BreakdownSection>
  </div>
}

function BreakdownSection({ title, emptyText, icon, children }: { title: string; emptyText: string; icon: ReactNode; children: ReactNode }) {
  const hasChildren = Boolean(children)
  return <section className="overview-breakdown" aria-label={title}><div className="overview-section-heading"><div><h2>{title}</h2></div><span className="overview-section-heading__icon">{icon}</span></div>{hasChildren ? children : <EmptyState variant="quiet" size="sm" className="overview-empty"><EmptyStateTitle>{emptyText}</EmptyStateTitle></EmptyState>}</section>
}

function CategoryBreakdown({ categories, mode, onOpenTransactions }: { categories: OverviewCategory[]; mode: OverviewMode; onOpenTransactions: (selection: OverviewSelection) => void }) {
  const maxAmount = Math.max(...categories.map((category) => category.amountCzk), 1)
  return <><CategoryDonut categories={categories} /><div className="overview-breakdown-list">{categories.map((category) => <button type="button" className="overview-breakdown-row" key={category.id} onClick={() => onOpenTransactions({ type: 'category', id: category.id, name: category.name })}>
    <span className={`overview-breakdown-row__icon color-key--${category.colorKey}`}><CategoryIcon iconKey={category.iconKey as CategoryIconKey} colorKey={category.colorKey as CategoryColorKey} /></span>
    <span className="overview-breakdown-row__content"><span className="overview-breakdown-row__name">{category.name}</span><span className="overview-breakdown-row__meta">{formatTransactionCount(category.transactionCount)}</span><span className="overview-breakdown-row__bar"><i style={{ '--overview-bar-size': `${Math.max(5, category.amountCzk / maxAmount * 100)}%` } as CSSProperties} /></span></span>
    <strong className={category.direction === 'income' ? 'is-positive' : mode === 'total' ? 'is-negative' : 'is-negative'}>{category.direction === 'income' ? '+' : '-'}{formatMoney(category.amountCzk)}</strong>
  </button>)}</div></>
}

function CategoryDonut({ categories }: { categories: OverviewCategory[] }) {
  const total = categories.reduce((sum, category) => sum + category.amountCzk, 0)
  let offset = 0
  const segments: DonutSegment[] = categories.map((category) => {
    const share = category.amountCzk / total * 100
    const segment = { category, share, offset }
    offset += share
    return segment
  })
  const annotations = selectDonutAnnotations(segments)
  return <div className="overview-category-donut" aria-label="Podíl kategorií">
    <div className="overview-category-donut__canvas">
      <svg viewBox="0 0 220 220" role="img" aria-label="Podíl všech kategorií v období">
        <circle className="overview-category-donut__track" cx="110" cy="110" r="45" />
        {segments.map(({ category, share, offset: segmentOffset }) => <circle
            key={category.id}
            className={`overview-category-donut__segment color-key--${category.colorKey}`}
            cx="110"
            cy="110"
            r="45"
            pathLength="100"
            strokeDasharray={`${share} ${100 - share}`}
            strokeDashoffset={-segmentOffset}
          />)}
        {annotations.map(({ category, startX, startY, endX, endY }) => <line className={`overview-category-donut__leader color-key--${category.colorKey}`} key={category.id} x1={startX} y1={startY} x2={endX} y2={endY} />)}
      </svg>
      {annotations.map(({ category, share, x, y }) => <div className={`overview-category-donut__annotation color-key--${category.colorKey}`} key={category.id} style={{ left: `${x / 220 * 100}%`, top: `${y / 220 * 100}%` }}>
        <span className="overview-category-donut__annotation-badge"><CategoryIcon iconKey={category.iconKey as CategoryIconKey} colorKey={category.colorKey as CategoryColorKey} /></span>
        <span className="overview-category-donut__percentage">{formatPercent(share)}</span>
      </div>)}
    </div>
  </div>
}

type DonutSegment = { category: OverviewCategory; share: number; offset: number }

function selectDonutAnnotations(segments: DonutSegment[]) {
  return segments.filter((segment) => segment.share >= 2.5).sort((left, right) => right.share - left.share).slice(0, 6).map((segment) => {
    const angle = ((segment.offset + segment.share / 2) / 100) * Math.PI * 2 - Math.PI / 2
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const x = 110 + cosine * 88
    const y = 110 + sine * 88
    return {
      ...segment,
      x,
      y,
      startX: 110 + cosine * 57,
      startY: 110 + sine * 57,
      endX: 110 + cosine * 74,
      endY: 110 + sine * 74,
    }
  })
}

function LabelBreakdown({ labels, onOpenTransactions }: { labels: LabelDisplay[]; onOpenTransactions: (selection: OverviewSelection) => void }) {
  const maxAmount = Math.max(...labels.map((label) => label.magnitudeCzk), 1)
  return <div className="overview-breakdown-list">{labels.map((label) => <button type="button" className="overview-breakdown-row" key={label.id} onClick={() => onOpenTransactions({ type: 'label', id: label.id, name: label.name })}>
    <span className="overview-breakdown-row__icon overview-breakdown-row__icon--label"><Tags aria-hidden="true" /></span>
    <span className="overview-breakdown-row__content"><span className="overview-breakdown-row__name">{label.name}</span><span className="overview-breakdown-row__meta">{formatLabelCount(label.transactionCount, label.transferCount)}</span><span className="overview-breakdown-row__bar"><i style={{ '--overview-bar-size': `${Math.max(5, label.magnitudeCzk / maxAmount * 100)}%` } as CSSProperties} /></span></span>
    <strong className={label.amountCzk > 0 ? 'is-positive' : 'is-negative'}>{formatSignedMoney(label.amountCzk, true)}</strong>
  </button>)}</div>
}

function WealthChart({ points }: { points: OverviewMetrics['wealthSeries'] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  if (!points.length) return <ChartEmpty />
  const values = points.map((point) => point.valueCzk)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const coordinates = points.map((point, index) => getChartPoint(point.valueCzk, index, points.length, min, span))
  const activePoint = activeIndex === null ? null : points[activeIndex]
  const activeCoordinates = activeIndex === null ? null : parseChartCoordinates(coordinates[activeIndex])

  return <div className="overview-chart"><div className="overview-chart__legend"><span>{formatCompactMoney(min)}</span><span>{formatCompactMoney(max)}</span></div><svg viewBox="0 0 300 148" role="img" aria-label="Vývoj celkového bohatství" onPointerDown={(event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width * 300
    const closestIndex = coordinates.reduce((closest, coordinate, index) => Math.abs(parseChartCoordinates(coordinate).x - x) < Math.abs(parseChartCoordinates(coordinates[closest]).x - x) ? index : closest, 0)
    setActiveIndex(closestIndex)
  }}>
    <line x1="0" x2="300" y1="132" y2="132" /><line x1="0" x2="300" y1="82" y2="82" /><line x1="0" x2="300" y1="32" y2="32" /><polyline points={coordinates.join(' ')} />
    {coordinates.map((coordinate, index) => {
      const { x, y } = parseChartCoordinates(coordinate)
      return <circle key={points[index].date} className="overview-chart__point-hit" cx={x} cy={y} r="9" tabIndex={0} role="button" aria-label={`${formatTooltipDate(points[index].date)}: ${formatMoney(points[index].valueCzk)}`} onFocus={() => setActiveIndex(index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveIndex(index) } }} />
    })}
    {activePoint && activeCoordinates ? <ChartSvgTooltip x={activeCoordinates.x} y={activeCoordinates.y} date={activePoint.date} value={formatMoney(activePoint.valueCzk)} /> : null}
  </svg><div className="overview-chart__dates"><span>{formatChartDate(points[0].date)}</span><span>{formatChartDate(points.at(-1)?.date ?? points[0].date)}</span></div></div>
}

function FlowChart({ points, mode }: { points: OverviewMetrics['flowSeries']; mode: Exclude<OverviewMode, 'total'> }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  if (!points.length) return <ChartEmpty />
  const values = points.map((point) => mode === 'income' ? point.incomeCzk : mode === 'expense' ? point.expenseCzk : point.incomeCzk - point.expenseCzk)
  const max = mode === 'cashflow' ? Math.max(...points.map((point) => point.incomeCzk), ...points.map((point) => point.expenseCzk), 1) : Math.max(...values.map((value) => Math.abs(value)), 1)
  const activePoint = activeIndex === null ? null : points[activeIndex]
  return <div className="overview-flow-chart" aria-label="Graf peněžního toku">{activePoint && activeIndex !== null ? <ChartHtmlTooltip point={activePoint} mode={mode} index={activeIndex} count={points.length} /> : null}<div className={`overview-flow-chart__columns ${mode === 'cashflow' ? 'overview-flow-chart__columns--cashflow' : ''}`}>{points.map((point, index) => {
    const value = values[index]
    if (mode === 'cashflow') return <button type="button" key={point.date} className="is-cashflow" aria-label={`${formatTooltipDate(point.date)}: příjmy ${formatMoney(point.incomeCzk)}, výdaje ${formatMoney(point.expenseCzk)}`} onClick={() => setActiveIndex(index)}><i className="overview-flow-chart__income" style={{ '--overview-flow-size': `${getBarSize(point.incomeCzk, max)}%` } as CSSProperties} /><i className="overview-flow-chart__expense" style={{ '--overview-flow-size': `${getBarSize(point.expenseCzk, max)}%` } as CSSProperties} /></button>
    return <button type="button" key={point.date} className={value < 0 ? 'is-negative' : mode === 'expense' ? 'is-negative' : 'is-positive'} aria-label={`${formatTooltipDate(point.date)}: ${formatFlowValue(value, mode)}`} onClick={() => setActiveIndex(index)}><i style={{ '--overview-flow-size': `${Math.max(5, Math.abs(value) / max * 100)}%` } as CSSProperties} /></button>
  })}</div><div className="overview-chart__dates"><span>{formatChartDate(points[0].date)}</span><span>{formatChartDate(points.at(-1)?.date ?? points[0].date)}</span></div></div>
}

function ChartSvgTooltip({ x, y, date, value }: { x: number; y: number; date: string; value: string }) {
  const tooltipX = Math.max(60, Math.min(240, x))
  const tooltipY = Math.max(28, y - 18)
  return <g className="overview-chart__tooltip" transform={`translate(${tooltipX} ${tooltipY})`} pointerEvents="none"><rect x="-58" y="-20" width="116" height="36" rx="6" /><text x="0" y="-7" textAnchor="middle">{formatTooltipDate(date)}</text><text x="0" y="8" textAnchor="middle">{value}</text></g>
}

function ChartHtmlTooltip({ point, mode, index, count }: { point: OverviewMetrics['flowSeries'][number]; mode: Exclude<OverviewMode, 'total'>; index: number; count: number }) {
  const cashflow = point.incomeCzk - point.expenseCzk
  const edge = count === 1 ? undefined : index === 0 ? 'start' : index === count - 1 ? 'end' : undefined
  return <div className="overview-flow-chart__tooltip" data-edge={edge} style={{ left: `${count === 1 ? 50 : index / (count - 1) * 100}%` }}><span>{formatTooltipDate(point.date)}</span>{mode === 'cashflow' ? <><strong className="is-positive">+ Příjmy {formatMoney(point.incomeCzk)}</strong><strong className="is-negative">- Výdaje {formatMoney(point.expenseCzk)}</strong><strong>Cashflow {formatFlowValue(cashflow, mode)}</strong></> : <strong>{formatFlowValue(mode === 'income' ? point.incomeCzk : point.expenseCzk, mode)}</strong>}</div>
}

function ChartEmpty() { return <div className="overview-chart overview-chart--empty"><BarChart3 aria-hidden="true" /><span>V tomto období zatím nejsou data pro graf.</span></div> }

function OverviewSkeleton() { return <div className="overview-skeleton" aria-label="Načítání přehledu"><Skeleton className="h-11 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-52 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div> }

function getPrimaryMetric(metrics: OverviewMetrics, mode: OverviewMode) {
  if (mode === 'income') return { label: 'Příjmy v období', amountCzk: metrics.flow.incomeCzk, tone: 'positive' as const, signed: true }
  if (mode === 'expense') return { label: 'Výdaje v období', amountCzk: metrics.flow.expenseCzk, tone: 'negative' as const, signed: true }
  if (mode === 'cashflow') return { label: 'Cashflow v období', amountCzk: metrics.flow.cashflowCzk, tone: metrics.flow.cashflowCzk >= 0 ? 'positive' as const : 'negative' as const, signed: true }
  return { label: 'Celkové bohatství', amountCzk: metrics.wealth.amountCzk, tone: metrics.wealth.amountCzk >= 0 ? 'positive' as const : 'negative' as const, signed: false }
}

type LabelDisplay = OverviewLabel & { amountCzk: number; magnitudeCzk: number }
function getLabelDisplay(label: OverviewLabel, mode: OverviewMode): LabelDisplay {
  const amountCzk = mode === 'income'
    ? label.incomeCzk
    : mode === 'expense'
      ? -label.expenseCzk
      : mode === 'cashflow'
        ? label.incomeCzk - label.expenseCzk
        : label.incomeCzk - label.expenseCzk + label.transferImpactCzk
  return { ...label, amountCzk, magnitudeCzk: Math.abs(amountCzk) }
}
function formatLabelCount(transactionCount: number, transferCount: number) {
  const count = transactionCount + transferCount
  return `${count} ${count === 1 ? 'položka' : count >= 2 && count <= 4 ? 'položky' : 'položek'}`
}
function isOverviewMode(value: string) : value is OverviewMode { return value === 'total' || value === 'income' || value === 'expense' || value === 'cashflow' }
function formatMoney(value: number) { return `${new Intl.NumberFormat('cs-CZ').format(Math.abs(value))} Kč` }
function formatSignedMoney(value: number, signed: boolean) { return `${signed ? value >= 0 ? '+' : '-' : value < 0 ? '-' : ''}${formatMoney(value)}` }
function formatPercent(value: number) { return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(value) + ' %' }
function formatFlowValue(value: number, mode: Exclude<OverviewMode, 'total'>) { return `${mode === 'expense' ? '-' : value < 0 ? '-' : value > 0 ? '+' : ''}${formatMoney(value)}` }
function getBarSize(value: number, max: number) { return value === 0 ? 0 : Math.max(5, value / max * 100) }
function formatCompactMoney(value: number) { return new Intl.NumberFormat('cs-CZ', { notation: 'compact', maximumFractionDigits: 1 }).format(value) + ' Kč' }
function formatTransactionCount(value: number) { return `${value} ${value === 1 ? 'transakce' : value >= 2 && value <= 4 ? 'transakce' : 'transakcí'}` }
function formatRange(from: string, to: string) { const formatter = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }); return `${formatter.format(parseDate(from))} až ${formatter.format(parseDate(to))}` }
function formatChartDate(value: string) { return new Intl.DateTimeFormat('cs-CZ', { month: 'short', year: 'numeric' }).format(parseDate(value)) }
function formatTooltipDate(value: string) { return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDate(value)) }
function getChartPoint(value: number, index: number, count: number, min: number, span: number) { return `${count === 1 ? 150 : index / (count - 1) * 300},${132 - (value - min) / span * 100}` }
function parseChartCoordinates(value: string) { const [x, y] = value.split(',').map(Number); return { x, y } }
function parseDate(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day) }
function isAbortError(error: unknown) { return error instanceof DOMException && error.name === 'AbortError' }
