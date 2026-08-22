import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CircleAlert, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
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
  }, [range?.dateFrom, range?.dateTo, walletKey, selectionKey, retryKey])

  if (!range || status === 'idle') return null
  if (status === 'loading') return <Card aria-label="Načítání naplánovaných položek" padding="none" className="planned-summary planned-summary--loading"><Skeleton className="h-6 w-6" /><div><Skeleton className="h-4 w-28" /><Skeleton className="mt-1 h-3 w-20" /></div><Skeleton className="ml-auto h-5 w-24" /></Card>
  if (status === 'error') return <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Naplánované se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={() => setRetryKey((current) => current + 1)}>Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
  if (!summary || summary.count === 0) return null

  return <Card render={<button type="button" onClick={onOpen} />} interactive padding="none" className="planned-summary">
    <CalendarClock aria-hidden="true" />
    <span className="planned-summary__content"><strong>Naplánované</strong><small>{formatCount(summary.count)}</small></span>
    <strong className={summary.totalCzk < 0 ? 'planned-summary__amount planned-summary__amount--expense' : 'planned-summary__amount'}>{formatCzk(summary.totalCzk, { signed: true })}</strong>
    <ChevronRight aria-hidden="true" />
  </Card>
}

function formatCount(count: number) {
  if (count === 1) return '1 položka'
  if (count >= 2 && count <= 4) return `${count} položky`
  return `${count} položek`
}
