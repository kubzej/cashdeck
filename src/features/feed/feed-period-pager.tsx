import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatFeedPeriodTitle, resolveFeedDateRange, shiftFeedPeriod, type FeedPeriod } from './feed-filters'
import { getPragueToday } from '../../lib/prague-date'

export function FeedPeriodPager({ period, periodAnchor, earliestActivityDate, onNavigate, children }: { period: Exclude<FeedPeriod, 'all' | 'custom'>; periodAnchor: string; earliestActivityDate: string | null; onNavigate: (periodAnchor: string) => void; children: ReactNode }) {
  const navigationLocked = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef(0)
  const dragFrame = useRef<number | null>(null)
  const [motion, setMotion] = useState<'from-left' | 'from-right' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [previewDirection, setPreviewDirection] = useState<'previous' | 'next' | null>(null)
  const previousAnchor = shiftFeedPeriod(periodAnchor, period, -1)
  const nextAnchor = shiftFeedPeriod(periodAnchor, period, 1)
  const hasPrevious = earliestActivityDate !== null && resolveFeedDateRange({ walletIds: [], period, periodAnchor: previousAnchor, customDateFrom: '', customDateTo: '', search: '' }).dateTo! >= earliestActivityDate
  const nextRange = resolveFeedDateRange({ walletIds: [], period, periodAnchor: nextAnchor, customDateFrom: '', customDateTo: '', search: '' })
  const hasNext = nextRange.dateFrom! <= getPragueToday()

  useEffect(() => {
    navigationLocked.current = false
  }, [periodAnchor])

  useEffect(() => () => {
    if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current)
  }, [])

  function navigate(anchor: string, nextMotion: 'from-left' | 'from-right') {
    if (navigationLocked.current) return
    navigationLocked.current = true
    setMotion(nextMotion)
    onNavigate(anchor)
  }

  function setPageOffset(offset: number) {
    dragOffset.current = offset
    if (dragFrame.current !== null) return
    dragFrame.current = window.requestAnimationFrame(() => {
      pageRef.current?.style.setProperty('--feed-period-drag-offset', `${dragOffset.current}px`)
      dragFrame.current = null
    })
  }

  function resetDrag() {
    pointerStart.current = null
    setIsDragging(false)
    setPreviewDirection(null)
    setPageOffset(0)
  }

  function finishNavigation(anchor: string, nextMotion: 'from-left' | 'from-right', targetOffset: number) {
    navigationLocked.current = true
    setIsDragging(false)
    setPageOffset(targetOffset)
    window.setTimeout(() => {
      setPreviewDirection(null)
      setPageOffset(0)
      setMotion(nextMotion)
      onNavigate(anchor)
    }, 180)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (navigationLocked.current) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    const viewport = viewportRef.current
    if (!start || !viewport) return

    const horizontalDistance = event.clientX - start.x
    const verticalDistance = event.clientY - start.y
    if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return

    const direction = horizontalDistance < 0 ? 'previous' : 'next'
    if ((direction === 'previous' && !hasPrevious) || (direction === 'next' && !hasNext)) return

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId)
    const limit = viewport.clientWidth * 0.82
    setIsDragging(true)
    setPreviewDirection(direction)
    setPageOffset(Math.max(-limit, Math.min(limit, horizontalDistance)))
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    if (!start) return

    const horizontalDistance = event.clientX - start.x
    const verticalDistance = event.clientY - start.y
    const isHorizontalDrag = Math.abs(horizontalDistance) > Math.abs(verticalDistance) && dragOffset.current !== 0
    if (!isHorizontalDrag) {
      pointerStart.current = null
      return
    }

    const width = viewportRef.current?.clientWidth ?? 0
    const shouldNavigate = Math.abs(horizontalDistance) >= Math.min(96, width * 0.24) && Math.abs(horizontalDistance) > Math.abs(verticalDistance)
    if (!shouldNavigate) {
      resetDrag()
      return
    }

    if (horizontalDistance < 0 && hasPrevious) {
      finishNavigation(previousAnchor, 'from-right', -width)
      return
    }
    if (horizontalDistance > 0 && hasNext) {
      finishNavigation(nextAnchor, 'from-left', width)
      return
    }
    resetDrag()
  }

  const previewAnchor = previewDirection === 'previous' ? previousAnchor : nextAnchor
  const previewTitle = formatFeedPeriodTitle(period, previewAnchor)

  return <section className="feed-period-pager" aria-label="Období transakcí">
    <div className="feed-period-pager__heading">
      <button type="button" className="feed-period-pager__nav" aria-label={`Předchozí období: ${formatFeedPeriodTitle(period, previousAnchor)}`} disabled={!hasPrevious} onClick={() => navigate(previousAnchor, 'from-left')}><ChevronLeft aria-hidden="true" /></button>
      <h2 className="feed-period-pager__title" aria-live="polite">{formatFeedPeriodTitle(period, periodAnchor)}</h2>
      <button type="button" className="feed-period-pager__nav" aria-label={`Následující období: ${formatFeedPeriodTitle(period, nextAnchor)}`} disabled={!hasNext} onClick={() => navigate(nextAnchor, 'from-right')}><ChevronRight aria-hidden="true" /></button>
    </div>
    <div ref={viewportRef} className="feed-period-pager__viewport" aria-label="Obsah období" data-preview={previewDirection ?? undefined} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={resetDrag}>
      <div className="feed-period-pager__preview-page" data-side={previewDirection === 'previous' ? 'right' : 'left'} aria-hidden="true">
        <span>{previewTitle}</span>
        <i /><i /><i />
      </div>
      <div ref={pageRef} className="feed-period-pager__interaction" data-dragging={isDragging || undefined}>
        <div key={periodAnchor} className="feed-period-pager__page" data-motion={motion ?? undefined}>{children}</div>
      </div>
    </div>
  </section>
}
