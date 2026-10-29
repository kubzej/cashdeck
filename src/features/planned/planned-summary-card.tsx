import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { LoadError } from '../../components/load-error'
import { formatItemCount } from '../../lib/format'
import { Card } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { formatCzk } from '../../lib/format-czk'
import type { FeedFilterValue } from '../feed/feed-filters'
import { listPlanned, type PlannedSummary } from './api'
import { resolvePlannedRange } from './planned-range'

export function PlannedSummaryCard({ filters, selection, onOpen }: { filters: FeedFilterValue; selection?: { type: 'category' | 'label'; id: string }; onOpen: () => void }) {
  const range = useMemo(() => resolvePlannedRange(filters), [filters])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [summary, setSummary] = useState<PlannedSummary | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const walletKey = filters.walletIds.join(',')
  const selectionKey = selection ? `${selection.type}:${selection.id}` : ''

  useEffect(() => {
    if (!range) {
      setStatus('idle')
      setSummary(null)
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    void listPlanned({ walletIds: filters.walletIds, ...range, categoryId: selection?.type === 'category' ? selection.id : undefined, labelId: selection?.type === 'label' ? selection.id : undefined, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setSummary(result.summary); setStatus('ready') } })
      .catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the deps list the stable walletKey and date fields, not the walletIds array / range object that get a new identity on every render
  }, [range?.dateFrom, range?.dateTo, walletKey, selectionKey, retryKey])

  if (!range || status === 'idle') return null
  if (status === 'loading') return <Card aria-label="Načítání naplánovaných položek" padding="none" className="planned-summary planned-summary--loading"><Skeleton className="h-6 w-6" /><div><Skeleton className="h-4 w-28" /><Skeleton className="mt-1 h-3 w-20" /></div><Skeleton className="ml-auto h-5 w-24" /></Card>
  if (status === 'error') return <LoadError title="Naplánované se nepodařilo načíst" layout="inline" onRetry={() => setRetryKey((current) => current + 1)} />
  if (!summary || summary.count === 0) return null

  return <Card render={<button type="button" onClick={onOpen} />} interactive padding="none" className="planned-summary">
    <CalendarClock aria-hidden="true" />
    <span className="planned-summary__content"><strong>Naplánované</strong><small>{formatItemCount(summary.count)}</small></span>
    <strong className={summary.totalCzk < 0 ? 'planned-summary__amount planned-summary__amount--expense' : 'planned-summary__amount'}>{formatCzk(summary.totalCzk, { signed: true })}</strong>
    <ChevronRight aria-hidden="true" />
  </Card>
}

