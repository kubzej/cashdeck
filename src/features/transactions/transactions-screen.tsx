import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, CircleAlert, ReceiptText, RefreshCw, Scale } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemDescription, ListItemLeading, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { formatCzk } from '../../lib/format-czk'
import { SEARCH_DEBOUNCE_MS } from '../../lib/search-debounce'
import { CategoryIcon } from '../categories/category-icon'
import { getFeedBounds, listFeed, type FeedBalanceAdjustment, type FeedItem, type FeedTransaction, type FeedTransfer } from '../feed/api'
import { createDefaultFeedFilters, FeedFilters, isNavigablePeriod, resolveFeedDateRange, type FeedFilterValue } from '../feed/feed-filters'
import { FeedPeriodPager } from '../feed/feed-period-pager'
import { PlannedSummaryCard } from '../planned/planned-summary-card'
import { SelectionSummaryCard } from './selection-summary-card'
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
    const timeout = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), SEARCH_DEBOUNCE_MS)
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

  // Naplánované is about upcoming activity in general — once a category/label/search filter
  // narrows the view to one slice, it's a distraction pointing at unrelated data, so it only
  // shows in the true "Celkem" state (no selection, no search).
  const showPlannedSummary = !fixedSelection && !debouncedSearch

  const content = <>
    {showPlannedSummary ? <PlannedSummaryCard filters={filters} selection={fixedSelection} onOpen={() => onOpenPlanned(filters)} /> : null}
    {status === 'loading' ? <List gap="sm" className="transactions-loading" aria-label="Načítání transakcí"><TransactionRowSkeleton /><TransactionRowSkeleton /><TransactionRowSkeleton /></List> : null}
    {status === 'error' ? <FeedbackState status="error" layout="panel" className="transactions-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Transakce se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={() => setReloadToken((current) => current + 1)}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState> : null}
    {status === 'ready' && activities.length === 0 ? <EmptyState variant="quiet" size="lg" className="screen-placeholder"><EmptyStateIcon><ReceiptText aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Zatím bez transakcí</EmptyStateTitle><EmptyStateDescription>Přidej první příjem nebo výdaj.</EmptyStateDescription></EmptyState> : null}
    {status === 'ready' ? <>{groupActivities(activities).map(([date, items]) => <div className="transaction-day" key={date}><h2>{formatDate(date)}</h2><List gap="sm">{items.map((activity) => {
      if (activity.kind === 'transaction') return <TransactionRow key={activity.id} transaction={activity} onSelect={onSelectTransaction} />
      if (activity.kind === 'transfer') return <TransferRow key={activity.id} transfer={activity} onSelect={onSelectTransfer} />
      return <BalanceAdjustmentRow key={activity.id} adjustment={activity} />
    })}</List></div>)}
    {nextCursor ? <Button variant="outline" className="transactions-load-more" loading={isLoadingMore} onClick={() => void loadMore()}>Načíst další</Button> : null}</> : null}
  </>

  return <section className="transactions-screen" aria-label="Seznam transakcí">
    <FeedFilters wallets={wallets} value={filters} onChange={setFilters} showReset={hasFiltersToClear} onReset={resetAllFilters} />
    <SelectionSummaryCard filters={filters} selection={fixedSelection} search={debouncedSearch} />
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

function TransactionRowSkeleton() {
  return <ListItem variant="quiet" size="default" className="transaction-row surface-row"><ListItemLeading><Skeleton shape="circle" /></ListItemLeading><ListItemContent><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></ListItemContent><ListItemActions><Skeleton className="h-4 w-14" /></ListItemActions></ListItem>
}

function TransactionRow({ transaction, onSelect }: { transaction: FeedTransaction; onSelect: (transaction: Transaction) => void }) {
  const amount = formatCzk(transaction.amountCzk)
  return <ListItem variant="quiet" size="default" interactive className="transaction-row surface-row" onClick={() => onSelect(transaction)}><ListItemLeading className={`transaction-row__category color-key--${transaction.categoryColorKey}`}><CategoryIcon iconKey={transaction.categoryIconKey} colorKey={transaction.categoryColorKey} /></ListItemLeading><ListItemContent><ListItemTitle><span>{transaction.categoryName}</span><span className="transaction-row__wallet">v {transaction.walletName}</span></ListItemTitle>{transaction.recurringRuleName ? <ListItemDescription className="transaction-row__recurring-name">{transaction.recurringRuleName}</ListItemDescription> : null}{transaction.labels.length > 0 ? <div className="transaction-row__labels">{transaction.labels.map((label) => <span key={label.id} className="transaction-row__label">{label.name}</span>)}</div> : null}{transaction.note ? <p className="transaction-row__note">{transaction.note}</p> : null}</ListItemContent><ListItemActions><strong className={transaction.direction === 'income' ? 'transaction-row__amount transaction-row__amount--income' : 'transaction-row__amount transaction-row__amount--expense'}>{transaction.direction === 'income' ? '+' : '-'}{amount}</strong></ListItemActions></ListItem>
}

function TransferRow({ transfer, onSelect }: { transfer: FeedTransfer; onSelect: (transfer: Transfer) => void }) {
  const amount = formatCzk(transfer.amountCzk)
  const impact = transfer.impactCzk
  const amountClass = impact > 0 ? 'transfer-row__amount transaction-row__amount--income' : impact < 0 ? 'transfer-row__amount transaction-row__amount--expense' : 'transfer-row__amount'
  const amountPrefix = impact > 0 ? '+' : impact < 0 ? '-' : ''
  return <ListItem variant="quiet" size="default" interactive className="transaction-row transfer-row surface-row" onClick={() => onSelect(transfer)}><ListItemLeading className="transfer-row__icon"><ArrowRightLeft aria-hidden="true" /></ListItemLeading><ListItemContent><ListItemTitle><span>Převod</span><span className="transaction-row__wallet">z {transfer.sourceWalletName} do {transfer.destinationWalletName}</span></ListItemTitle>{transfer.recurringRuleName ? <ListItemDescription className="transaction-row__recurring-name">{transfer.recurringRuleName}</ListItemDescription> : null}{transfer.labels.length > 0 ? <div className="transaction-row__labels">{transfer.labels.map((label) => <span key={label.id} className="transaction-row__label">{label.name}</span>)}</div> : null}{transfer.note ? <p className="transaction-row__note">{transfer.note}</p> : null}</ListItemContent><ListItemActions><strong className={amountClass}>{amountPrefix}{amount}</strong></ListItemActions></ListItem>
}

function BalanceAdjustmentRow({ adjustment }: { adjustment: FeedBalanceAdjustment }) {
  const amount = formatCzk(adjustment.amountCzk)
  const isAddition = adjustment.operation === 'add'
  return <ListItem variant="quiet" size="default" className="transaction-row balance-adjustment-row surface-row"><ListItemLeading className="balance-adjustment-row__icon"><Scale aria-hidden="true" /></ListItemLeading><ListItemContent><ListItemTitle><span>Vyrovnání zůstatku</span><span className="transaction-row__wallet">v {adjustment.walletName}</span></ListItemTitle></ListItemContent><ListItemActions><strong className={isAddition ? 'transaction-row__amount transaction-row__amount--income' : 'transaction-row__amount transaction-row__amount--expense'}>{isAddition ? '+' : '-'}{amount}</strong></ListItemActions></ListItem>
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

function activityDate(activity: FeedItem) { return activity.kind === 'transaction' ? activity.transactionDate : activity.kind === 'transfer' ? activity.transferDate : activity.adjustmentDate }

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function isAbortError(error: unknown) { return error instanceof DOMException && error.name === 'AbortError' }
