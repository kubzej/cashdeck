import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRightLeft, CalendarClock, CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemLeading, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { CategoryIcon } from '../categories/category-icon'
import type { FeedFilterValue } from '../feed/feed-filters'
import type { Transaction } from '../transactions/api'
import type { Transfer } from '../transfers/api'
import { listPlanned, type PlannedItem } from './api'
import { resolvePlannedRange } from './planned-range'
import './planned.css'

export function PlannedScreen({ filters, onBack, onSelectTransaction, onSelectTransfer }: {
  filters: FeedFilterValue
  onBack: () => void
  onSelectTransaction: (transaction: Transaction) => void
  onSelectTransfer: (transfer: Transfer) => void
}) {
  const range = useMemo(() => resolvePlannedRange(filters), [filters])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [items, setItems] = useState<PlannedItem[]>([])
  const [retryKey, setRetryKey] = useState(0)
  const walletKey = filters.walletIds.join(',')

  useEffect(() => {
    if (!range) return
    const controller = new AbortController()
    setStatus('loading')
    void listPlanned({ walletIds: filters.walletIds, ...range, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        setItems(result.items)
        setStatus('ready')
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [range?.dateFrom, range?.dateTo, walletKey, retryKey])

  return <section className="planned-screen" aria-labelledby="planned-title">
    <header className="planned-header">
      <Button variant="ghost" size="icon" aria-label="Zpět k transakcím" onClick={onBack}><ArrowLeft aria-hidden="true" /></Button>
      <h1 id="planned-title">Naplánované</h1>
      <span aria-hidden="true" />
    </header>
    {!range ? <EmptyState variant="quiet" size="lg" className="planned-empty"><EmptyStateIcon><CalendarClock aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>V tomto období nic budoucího není</EmptyStateTitle><EmptyStateDescription>Zvol období, které zasahuje do budoucnosti.</EmptyStateDescription></EmptyState> : <>
      <PlannedContent status={status} items={items} onRetry={() => setRetryKey((current) => current + 1)} onSelectTransaction={onSelectTransaction} onSelectTransfer={onSelectTransfer} />
    </>}
  </section>
}

function PlannedContent({ status, items, onRetry, onSelectTransaction, onSelectTransfer }: {
  status: 'loading' | 'ready' | 'error'
  items: PlannedItem[]
  onRetry: () => void
  onSelectTransaction: (transaction: Transaction) => void
  onSelectTransfer: (transfer: Transfer) => void
}) {
  if (status === 'loading') return <div className="planned-loading" aria-label="Načítání naplánovaných položek"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
  if (status === 'error') return <FeedbackState status="error" layout="panel" className="planned-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Naplánované se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
  if (items.length === 0) return <EmptyState variant="quiet" size="lg" className="planned-empty"><EmptyStateIcon><CalendarClock aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Bez naplánovaných položek</EmptyStateTitle><EmptyStateDescription>V tomto budoucím období nic nečeká.</EmptyStateDescription></EmptyState>
  return <div className="planned-list" aria-label="Seznam naplánovaných položek">{groupItems(items).map(([date, entries]) => <section className="planned-day" key={date}><h2>{formatDate(date)}</h2><List gap="sm">{entries.map((item) => <PlannedRow key={item.id} item={item} onSelectTransaction={onSelectTransaction} onSelectTransfer={onSelectTransfer} />)}</List></section>)}</div>
}

function PlannedRow({ item, onSelectTransaction, onSelectTransfer }: { item: PlannedItem; onSelectTransaction: (transaction: Transaction) => void; onSelectTransfer: (transfer: Transfer) => void }) {
  const interactive = item.origin === 'manual'
  const select = () => {
    if (!interactive) return
    if (item.kind === 'transaction') onSelectTransaction(item)
    else onSelectTransfer(item)
  }
  const content = <>
    {item.kind === 'transaction' ? <ListItemLeading className={`planned-row__icon color-key--${item.categoryColorKey}`}><CategoryIcon iconKey={item.categoryIconKey} colorKey={item.categoryColorKey} /></ListItemLeading> : <ListItemLeading className="planned-row__icon planned-row__icon--transfer"><ArrowRightLeft aria-hidden="true" /></ListItemLeading>}
    <ListItemContent>
      <ListItemTitle>{item.origin === 'recurring' && item.recurringRuleName ? item.recurringRuleName : getItemTitle(item)}</ListItemTitle>
      <p className="planned-row__subtitle">{getItemSubtitle(item)}</p>
      {item.labels.length > 0 ? <div className="planned-row__labels">{item.labels.map((label) => <span key={label.id}>{label.name}</span>)}</div> : null}
      {item.note ? <p className="planned-row__note">{item.note}</p> : null}
      {item.origin === 'recurring' ? <p className="planned-row__recurring"><CalendarClock aria-hidden="true" />Opakování</p> : null}
    </ListItemContent>
    <ListItemActions><strong className={getAmountClass(item)}>{formatItemAmount(item)}</strong></ListItemActions>
  </>
  return interactive
    ? <ListItem render={<button type="button" onClick={select} />} interactive variant="quiet" size="default" className="surface-row planned-row">{content}</ListItem>
    : <ListItem variant="quiet" size="default" className="surface-row planned-row planned-row--recurring">{content}</ListItem>
}

function groupItems(items: PlannedItem[]) {
  const groups = new Map<string, PlannedItem[]>()
  for (const item of items) {
    const date = getItemDate(item)
    groups.set(date, [...(groups.get(date) ?? []), item])
  }
  return [...groups.entries()]
}

function getItemTitle(item: PlannedItem) {
  return item.kind === 'transaction' ? item.categoryName : 'Převod'
}

function getItemDate(item: PlannedItem) {
  return item.kind === 'transaction' ? item.transactionDate : item.transferDate
}

function getItemSubtitle(item: PlannedItem) {
  if (item.kind === 'transaction') return `v ${item.walletName}`
  return `${item.sourceWalletName} do ${item.destinationWalletName}`
}

function getAmountClass(item: PlannedItem) {
  if (item.kind === 'transaction') return item.direction === 'income' ? 'planned-row__amount planned-row__amount--income' : 'planned-row__amount planned-row__amount--expense'
  return item.impactCzk > 0 ? 'planned-row__amount planned-row__amount--income' : item.impactCzk < 0 ? 'planned-row__amount planned-row__amount--expense' : 'planned-row__amount'
}

function formatItemAmount(item: PlannedItem) {
  const value = item.kind === 'transaction' ? (item.direction === 'income' ? item.amountCzk : -item.amountCzk) : item.impactCzk
  const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
  const displayAmount = item.kind === 'transfer' && value === 0 ? item.amountCzk : Math.abs(value)
  return `${prefix}${new Intl.NumberFormat('cs-CZ').format(displayAmount)} Kč`
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}
