import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatFeedPeriodTitle, getFeedToday, resolveFeedDateRange, shiftFeedPeriod, type FeedPeriod } from './feed-filters'

export function FeedPeriodPager({ period, periodAnchor, earliestActivityDate, onNavigate, children }: { period: Exclude<FeedPeriod, 'all' | 'custom'>; periodAnchor: string; earliestActivityDate: string | null; onNavigate: (periodAnchor: string) => void; children: ReactNode }) {
  const navigationLocked = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const previousAnchor = shiftFeedPeriod(periodAnchor, period, -1)
  const nextAnchor = shiftFeedPeriod(periodAnchor, period, 1)
  const hasPrevious = earliestActivityDate !== null && resolveFeedDateRange({ walletIds: [], period, periodAnchor: previousAnchor, customDateFrom: '', customDateTo: '', search: '' }).dateTo! >= earliestActivityDate
  const latestRange = resolveFeedDateRange({ walletIds: [], period, periodAnchor: getFeedToday(), customDateFrom: '', customDateTo: '', search: '' })
  const nextRange = resolveFeedDateRange({ walletIds: [], period, periodAnchor: nextAnchor, customDateFrom: '', customDateTo: '', search: '' })
  const hasNext = nextRange.dateFrom! <= latestRange.dateFrom!

  useEffect(() => {
    navigationLocked.current = false
  }, [periodAnchor])

  function navigate(anchor: string) {
    if (navigationLocked.current) return
    navigationLocked.current = true
    onNavigate(anchor)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return

    const horizontalDistance = event.clientX - start.x
    const verticalDistance = event.clientY - start.y
    if (Math.abs(horizontalDistance) < 56 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return
    if (horizontalDistance < 0 && hasPrevious) navigate(previousAnchor)
    if (horizontalDistance > 0 && hasNext) navigate(nextAnchor)
  }

  return <section className="feed-period-pager" aria-label="Období transakcí">
    <div className="feed-period-pager__heading">
      <button type="button" className="feed-period-pager__nav" aria-label={`Předchozí období: ${formatFeedPeriodTitle(period, previousAnchor)}`} disabled={!hasPrevious} onClick={() => navigate(previousAnchor)}><ChevronLeft aria-hidden="true" /></button>
      <h2 className="feed-period-pager__title" aria-live="polite">{formatFeedPeriodTitle(period, periodAnchor)}</h2>
      <button type="button" className="feed-period-pager__nav" aria-label={`Následující období: ${formatFeedPeriodTitle(period, nextAnchor)}`} disabled={!hasNext} onClick={() => navigate(nextAnchor)}><ChevronRight aria-hidden="true" /></button>
    </div>
    <div className="feed-period-pager__viewport" aria-label="Obsah období" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { pointerStart.current = null }}>
      <div className="feed-period-pager__page">{children}</div>
    </div>
  </section>
}
