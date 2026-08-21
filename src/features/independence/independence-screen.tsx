import { useEffect, useState, type CSSProperties } from 'react'
import { CircleAlert, RefreshCw, Settings2, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/button'

import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Skeleton } from '../../components/ui/skeleton'
import { formatCzk } from '../../lib/format-czk'
import { parseIsoDate } from '../../lib/prague-date'
import { WalletTypeIcon, walletTypeLabel } from '../wallets/wallet-type-icon'
import { getIndependenceProgress, getIndependenceSettings, getIndependenceWealthSeries, type IndependenceProgress } from './api'
import './independence.css'

export function IndependenceScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [progress, setProgress] = useState<IndependenceProgress | null>(null)
  const [series, setSeries] = useState<Array<{ date: string; amountCzk: number }>>([])
  const [ownReturnPercent, setOwnReturnPercent] = useState<number | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    Promise.all([getIndependenceProgress(), getIndependenceWealthSeries(), getIndependenceSettings()])
      .then(([progressResult, seriesResult, settingsResult]) => {
        if (controller.signal.aborted) return
        setProgress(progressResult)
        setSeries(seriesResult.points)
        setOwnReturnPercent(settingsResult.settings?.expectedRealReturnPercent ?? null)
        setStatus('ready')
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [reloadToken])

  return (
    <section className="independence-screen" aria-label="Nezávislost">
      {status === 'loading' ? <div className="independence-screen-loading" aria-label="Načítání nezávislosti"><Skeleton className="h-28 w-full" /><Skeleton className="h-16 w-full" /></div> : null}

      {status === 'error' ? (
        <FeedbackState status="error" layout="panel" className="independence-screen-feedback">
          <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
          <FeedbackStateContent><FeedbackStateTitle>Nezávislost se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent>
          <FeedbackStateActions><Button variant="outline" onClick={() => setReloadToken((current) => current + 1)}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions>
        </FeedbackState>
      ) : null}

      {status === 'ready' && progress && !progress.hasSettings ? (
        <EmptyState variant="quiet" size="lg" className="screen-placeholder">
          <EmptyStateIcon><Sparkles aria-hidden="true" /></EmptyStateIcon>
          <EmptyStateTitle>Nezávislost ještě není nastavená</EmptyStateTitle>
          <EmptyStateDescription>Nastav si výběrovou sazbu a očekávané roční náklady, ať víš, kam směřuješ.</EmptyStateDescription>
          <EmptyStateActions><Button onClick={onOpenSettings}><Settings2 aria-hidden="true" />Nastavit nezávislost</Button></EmptyStateActions>
        </EmptyState>
      ) : null}

      {status === 'ready' && progress && progress.hasSettings ? (
        <div className="independence-screen-content">
          <div className="independence-progress-grid">
            <ProgressCard label="Celkem" amountCzk={progress.totalWealthCzk} percent={progress.totalProgressPercent} years={progress.yearsToTotal} />
            <ProgressCard label="Dostupné" amountCzk={progress.availableWealthCzk} percent={progress.availableProgressPercent} years={progress.yearsToAvailable} />
          </div>

          <section className="independence-target-card">
            <span className="independence-target-card__label">Cílová částka</span>
            <strong className="independence-target-card__amount">{formatCzk(progress.independenceNumberCzk)}</strong>
            <span className="independence-target-card__meta">
              roční náklady dnes: {formatCzk(progress.annualExpensesCzk)}
              {progress.futureAnnualExpensesCzk !== null && progress.yearsToAvailable ? <> · za {formatYears(progress.yearsToAvailable)}: {formatCzk(progress.futureAnnualExpensesCzk)}</> : null}
            </span>
          </section>

          {progress.wealthByType.length > 0 ? (
            <section className="independence-wealth-by-type" aria-label="Rozložení podle typu peněženky">
              <h2>Rozložení podle typu</h2>
              <WealthByTypeList entries={progress.wealthByType} totalCzk={progress.totalWealthCzk} />
            </section>
          ) : null}

          {progress.returnSensitivity.length > 0 ? (
            <section className="independence-sensitivity" aria-label="Citlivost cíle na očekávaný výnos">
              <h2>Citlivost na výnos</h2>
              <ReturnSensitivityList entries={progress.returnSensitivity} ownReturnPercent={ownReturnPercent} />
            </section>
          ) : null}

          {series.length > 1 ? (
            <section className="independence-wealth-trend" aria-label="Vývoj investičního jmění za posledních 12 měsíců">
              <h2>Vývoj investičního jmění</h2>
              <WealthTrendChart points={series} />
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function WealthByTypeList({ entries, totalCzk }: { entries: IndependenceProgress['wealthByType']; totalCzk: number }) {
  return (
    <ul className="independence-wealth-by-type__list">
      {entries.map((entry) => {
        const percent = totalCzk > 0 ? (entry.amountCzk / totalCzk) * 100 : 0
        return (
          <li key={entry.walletType} className="independence-wealth-by-type__item">
            <WalletTypeIcon walletType={entry.walletType} className="independence-wealth-by-type__icon" />
            <span className="independence-wealth-by-type__label">{walletTypeLabel(entry.walletType)}</span>
            <span className="independence-wealth-by-type__amount">{formatCzk(entry.amountCzk)}</span>
            <span className="independence-wealth-by-type__percent">{formatPercent(percent)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function ReturnSensitivityList({ entries, ownReturnPercent }: { entries: IndependenceProgress['returnSensitivity']; ownReturnPercent: number | null }) {
  return (
    <ul className="independence-sensitivity__list">
      {entries.map((entry) => {
        const isOwn = ownReturnPercent !== null && entry.realReturnPercent === ownReturnPercent
        return (
          <li key={entry.realReturnPercent} className={`independence-sensitivity__item${isOwn ? ' independence-sensitivity__item--own' : ''}`}>
            <span className="independence-sensitivity__rate">{entry.realReturnPercent} %{isOwn ? <span className="independence-sensitivity__own-tag">tvoje nastavení</span> : null}</span>
            <span className="independence-sensitivity__years">{entry.yearsToTotal === null ? 'bez projekce' : entry.yearsToTotal === 0 ? 'už teď' : formatYears(entry.yearsToTotal)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function ProgressCard({ label, amountCzk, percent, years }: { label: string; amountCzk: number; percent: number; years: number | null }) {
  const clampedPercent = Math.max(0, Math.min(100, percent))
  return (
    <section className="independence-progress-card">
      <span className="independence-progress-card__label">{label}</span>
      <strong className="independence-progress-card__amount">{formatCzk(amountCzk)}</strong>
      <div className="independence-progress-card__bar"><i style={{ '--independence-progress-size': `${clampedPercent}%` } as CSSProperties} /></div>
      <span className="independence-progress-card__percent">{formatPercent(percent)}</span>
      <span className="independence-progress-card__years">{years === null ? 'bez projekce' : years === 0 ? 'už teď' : `za ${formatYears(years)} (cca ${targetYear(years)})`}</span>
    </section>
  )
}

function WealthTrendChart({ points }: { points: Array<{ date: string; amountCzk: number }> }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const values = points.map((point) => point.amountCzk)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const span = max - min || 1
  const coordinates = points.map((point, index) => getChartPoint(point.amountCzk, index, points.length, min, span))
  const activePoint = activeIndex === null ? null : points[activeIndex]
  const activeCoordinates = activeIndex === null ? null : parseChartCoordinates(coordinates[activeIndex])

  return (
    <div className="independence-wealth-trend__chart">
      <div className="independence-wealth-trend__legend"><span>{formatCzk(max)}</span><span>{formatCzk(min)}</span></div>
      <svg
        viewBox="0 0 300 148"
        role="img"
        aria-label={`Investiční jmění od ${formatMonth(points[0].date)} do ${formatMonth(points.at(-1)?.date ?? points[0].date)}`}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = (event.clientX - bounds.left) / bounds.width * 300
          const closestIndex = coordinates.reduce((closest, coordinate, index) => Math.abs(parseChartCoordinates(coordinate).x - x) < Math.abs(parseChartCoordinates(coordinates[closest]).x - x) ? index : closest, 0)
          setActiveIndex(closestIndex)
        }}
      >
        <line x1="0" x2="300" y1="132" y2="132" /><line x1="0" x2="300" y1="82" y2="82" /><line x1="0" x2="300" y1="32" y2="32" />
        <polyline points={coordinates.join(' ')} />
        {coordinates.map((coordinate, index) => {
          const { x, y } = parseChartCoordinates(coordinate)
          return <circle key={points[index].date} className="independence-wealth-trend__point-hit" cx={x} cy={y} r="9" tabIndex={0} role="button" aria-label={`${formatMonth(points[index].date)}: ${formatCzk(points[index].amountCzk)}`} onFocus={() => setActiveIndex(index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveIndex(index) } }} />
        })}
        {activePoint && activeCoordinates ? <ChartSvgTooltip x={activeCoordinates.x} y={activeCoordinates.y} label={formatMonth(activePoint.date)} value={formatCzk(activePoint.amountCzk)} /> : null}
      </svg>
      <div className="independence-wealth-trend__dates"><span>{formatMonth(points[0].date)}</span><span>{formatMonth(points.at(-1)?.date ?? points[0].date)}</span></div>
    </div>
  )
}

function ChartSvgTooltip({ x, y, label, value }: { x: number; y: number; label: string; value: string }) {
  const tooltipX = Math.max(60, Math.min(240, x))
  const tooltipY = Math.max(28, y - 18)
  return (
    <g className="independence-wealth-trend__tooltip" transform={`translate(${tooltipX} ${tooltipY})`} pointerEvents="none">
      <rect x="-58" y="-20" width="116" height="36" rx="6" />
      <text x="0" y="-7" textAnchor="middle">{label}</text>
      <text x="0" y="8" textAnchor="middle">{value}</text>
    </g>
  )
}

function getChartPoint(value: number, index: number, count: number, min: number, span: number) {
  return `${count === 1 ? 150 : index / (count - 1) * 300},${132 - (value - min) / span * 100}`
}

function parseChartCoordinates(value: string) {
  const [x, y] = value.split(',').map(Number)
  return { x, y }
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(Math.max(0, value))} %`
}

function formatYears(years: number) {
  if (years < 1) return `${Math.round(years * 12)} měsíců`
  const whole = Math.round(years * 10) / 10
  return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(whole)} let`
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('cs-CZ', { month: 'short', year: 'numeric' }).format(parseIsoDate(value))
}

function targetYear(years: number) {
  return new Date().getFullYear() + Math.round(years)
}
