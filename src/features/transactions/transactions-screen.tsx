import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, CircleAlert, ReceiptText, RefreshCw, Tags } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemLeading, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { CategoryIcon } from '../categories/category-icon'
import { getFeedBounds, listFeed, type FeedItem, type FeedTransfer } from '../feed/api'
import { createDefaultFeedFilters, FeedFilters, isNavigablePeriod, resolveFeedDateRange, type FeedFilterValue } from '../feed/feed-filters'
import { FeedPeriodPager } from '../feed/feed-period-pager'
import { PlannedSummaryCard } from '../planned/planned-summary-card'
import type { Transaction } from './api'
import type { Transfer } from '../transfers/api'
import { listWallets, type Wallet } from '../wallets/api'
import type { OverviewSelection } from '../overview/overview-screen'
import './transactions.css'

export function TransactionsScreen({ onSelectTransaction, onSelectTransfer, onOpenPlanned, initialWalletId, initialFilters, fixedSelection, onResetFilters }: { onSelectTransaction: (transaction: Transaction) => void; onSelectTransfer: (transfer: Transfer) => void; onOpenPlanned: (filters: FeedFilterValue) => void; initialWalletId?: string; initialFilters?: FeedFilterValue; fixedSelection?: OverviewSelection; onResetFilters?: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [activities, setActivities] = useState<FeedItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [earliestActivityDate, setEarliestActivityDate] = useState<string | null>(null)
  const [filters, setFilters] = useState<FeedFilterValue>(() => initialFilters ?? { ...createDefaultFeedFilters(), walletIds: initialWalletId ? [initialWalletId] : [] })
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  const [reloadToken, setReloadToken] = useState(0)
  const moreRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [filters.search])

  useEffect(() => {
    void listWallets().then((result) => setWallets(result.items)).catch(() => setWallets([]))
  }, [])

  const walletFilterKey = filters.walletIds.join(',')
  useEffect(() => {
    const controller = new AbortController()
    setEarliestActivityDate(null)
    void getFeedBounds({ walletIds: filters.walletIds, categoryId: fixedSelection?.type === 'category' ? fixedSelection.id : undefined, labelId: fixedSelection?.type === 'label' ? fixedSelection.id : undefined, signal: controller.signal }).then((bounds) => {
      if (!controller.signal.aborted) setEarliestActivityDate(bounds.earliestActivityDate)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && !isAbortError(error)) setEarliestActivityDate(null)
    })
    return () => controller.abort()
  }, [walletFilterKey, fixedSelection?.id, fixedSelection?.type])

  const range = resolveFeedDateRange(filters)
  const filterKey = JSON.stringify({ walletIds: filters.walletIds, ...range, search: debouncedSearch, fixedSelection, reloadToken })

  useEffect(() => {
    const controller = new AbortController()
    moreRequest.current?.abort()
    setIsLoadingMore(false)
    setStatus('loading')
    void listFeed({ walletIds: filters.walletIds, ...range, search: debouncedSearch || undefined, categoryId: fixedSelection?.type === 'category' ? fixedSelection.id : undefined, labelId: fixedSelection?.type === 'label' ? fixedSelection.id : undefined, signal: controller.signal }).then((page) => {
      if (controller.signal.aborted) return
      setActivities(page.items)
      setNextCursor(page.nextCursor)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted || isAbortError(error)) return
      setStatus('error')
    })
    return () => controller.abort()
  }, [filterKey])

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return
    const controller = new AbortController()
    moreRequest.current = controller
    setIsLoadingMore(true)
    try {
      const page = await listFeed({ walletIds: filters.walletIds, ...range, search: debouncedSearch || undefined, categoryId: fixedSelection?.type === 'category' ? fixedSelection.id : undefined, labelId: fixedSelection?.type === 'label' ? fixedSelection.id : undefined, cursor: nextCursor, signal: controller.signal })
      if (controller.signal.aborted) return
      setActivities((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
    } catch (error) {
      if (!controller.signal.aborted && !isAbortError(error)) return
    } finally {
      if (!controller.signal.aborted) setIsLoadingMore(false)
    }
  }

  function resetAllFilters() {
    setFilters(createDefaultFeedFilters())
    setDebouncedSearch('')
    onResetFilters?.()
  }

  const hasFiltersToClear = Boolean(fixedSelection) || !hasDefaultFilters(filters)

  const content = <>
    <PlannedSummaryCard filters={filters} selection={fixedSelection} onOpen={() => onOpenPlanned(filters)} />
    {status === 'loading' ? <div className="transactions-loading" aria-label="Načítání transakcí"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : null}
    {status === 'error' ? <FeedbackState status="error" layout="panel" className="transactions-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Transakce se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={() => setReloadToken((current) => current + 1)}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState> : null}
    {status === 'ready' && activities.length === 0 ? <EmptyState variant="quiet" size="lg" className="screen-placeholder"><EmptyStateIcon><ReceiptText aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Zatím bez transakcí</EmptyStateTitle><EmptyStateDescription>Přidej první příjem nebo výdaj.</EmptyStateDescription></EmptyState> : null}
    {status === 'ready' ? <>{groupActivities(activities).map(([date, items]) => <div className="transaction-day" key={date}><h2>{formatDate(date)}</h2><List gap="sm">{items.map((activity) => activity.kind === 'transaction' ? <TransactionRow key={activity.id} transaction={activity} onSelect={onSelectTransaction} /> : <TransferRow key={activity.id} transfer={activity} onSelect={onSelectTransfer} />)}</List></div>)}
    {nextCursor ? <Button variant="outline" className="transactions-load-more" loading={isLoadingMore} onClick={() => void loadMore()}>Načíst další</Button> : null}</> : null}
  </>

  return <section className="transactions-screen" aria-label="Seznam transakcí">
    <FeedFilters wallets={wallets} value={filters} onChange={setFilters} showReset={hasFiltersToClear} onReset={resetAllFilters} />
    {fixedSelection ? <div className="transaction-fixed-selection"><Tags aria-hidden="true" /><span>{fixedSelection.type === 'category' ? 'Kategorie' : 'Štítek'}: <strong>{fixedSelection.name}</strong></span></div> : null}
    {isNavigablePeriod(filters.period) ? <FeedPeriodPager period={filters.period} periodAnchor={filters.periodAnchor} earliestActivityDate={earliestActivityDate} onNavigate={(periodAnchor) => setFilters((current) => ({ ...current, periodAnchor }))}>{content}</FeedPeriodPager> : content}
  </section>
}

function hasDefaultFilters(filters: FeedFilterValue) {
  const defaults = createDefaultFeedFilters()
  return filters.walletIds.length === 0
    && filters.period === defaults.period
    && filters.periodAnchor === defaults.periodAnchor
    && filters.customDateFrom === defaults.customDateFrom
    && filters.customDateTo === defaults.customDateTo
    && filters.search.trim() === ''
}

function TransactionRow({ transaction, onSelect }: { transaction: Transaction; onSelect: (transaction: Transaction) => void }) {
  const amount = new Intl.NumberFormat('cs-CZ').format(transaction.amountCzk)
  return <ListItem variant="quiet" size="default" interactive className="transaction-row surface-row" onClick={() => onSelect(transaction)}><ListItemLeading className={`transaction-row__category color-key--${transaction.categoryColorKey}`}><CategoryIcon iconKey={transaction.categoryIconKey} colorKey={transaction.categoryColorKey} /></ListItemLeading><ListItemContent><ListItemTitle><span>{transaction.categoryName}</span><span className="transaction-row__wallet">v {transaction.walletName}</span></ListItemTitle>{transaction.labels.length > 0 ? <div className="transaction-row__labels">{transaction.labels.map((label) => <span key={label.id} className="transaction-row__label">{label.name}</span>)}</div> : null}{transaction.note ? <p className="transaction-row__note">{transaction.note}</p> : null}</ListItemContent><ListItemActions><strong className={transaction.direction === 'income' ? 'transaction-row__amount transaction-row__amount--income' : 'transaction-row__amount transaction-row__amount--expense'}>{transaction.direction === 'income' ? '+' : '-'}{amount} Kč</strong></ListItemActions></ListItem>
}

function TransferRow({ transfer, onSelect }: { transfer: FeedTransfer; onSelect: (transfer: Transfer) => void }) {
  const amount = new Intl.NumberFormat('cs-CZ').format(transfer.amountCzk)
  const impact = transfer.impactCzk
  const amountClass = impact > 0 ? 'transfer-row__amount transaction-row__amount--income' : impact < 0 ? 'transfer-row__amount transaction-row__amount--expense' : 'transfer-row__amount'
  const amountPrefix = impact > 0 ? '+' : impact < 0 ? '-' : ''
  return <ListItem variant="quiet" size="default" interactive className="transaction-row transfer-row surface-row" onClick={() => onSelect(transfer)}><ListItemLeading className="transfer-row__icon"><ArrowRightLeft aria-hidden="true" /></ListItemLeading><ListItemContent><ListItemTitle><span>Převod</span><span className="transaction-row__wallet">z {transfer.sourceWalletName} do {transfer.destinationWalletName}</span></ListItemTitle>{transfer.labels.length > 0 ? <div className="transaction-row__labels">{transfer.labels.map((label) => <span key={label.id} className="transaction-row__label">{label.name}</span>)}</div> : null}{transfer.note ? <p className="transaction-row__note">{transfer.note}</p> : null}</ListItemContent><ListItemActions><strong className={amountClass}>{amountPrefix}{amount} Kč</strong></ListItemActions></ListItem>
}

function groupActivities(activities: FeedItem[]) {
  const groups = new Map<string, FeedItem[]>()
  for (const activity of activities) {
    const date = activityDate(activity)
    const group = groups.get(date) ?? []
    group.push(activity)
    groups.set(date, group)
  }
  return [...groups.entries()]
}

function activityDate(activity: FeedItem) { return activity.kind === 'transaction' ? activity.transactionDate : activity.transferDate }

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function isAbortError(error: unknown) { return error instanceof DOMException && error.name === 'AbortError' }
