import { useEffect, useState } from 'react'
import { ArrowRightLeft, CircleAlert, ReceiptText, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemLeading, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { CategoryIcon } from '../categories/category-icon'
import { listFeed, type FeedItem } from '../feed/api'
import type { Transaction } from './api'
import type { Transfer } from '../transfers/api'
import './transactions.css'

export function TransactionsScreen({ onSelectTransaction, onSelectTransfer }: { onSelectTransaction: (transaction: Transaction) => void; onSelectTransfer: (transfer: Transfer) => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [activities, setActivities] = useState<FeedItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  async function loadActivities(loadMore = false) {
    if (loadMore) setIsLoadingMore(true)
    else setStatus('loading')
    try {
      const page = await listFeed({ cursor: loadMore ? nextCursor ?? undefined : undefined })
      setActivities((current) => loadMore ? [...current, ...page.items] : page.items)
      setNextCursor(page.nextCursor)
      setStatus('ready')
    } catch {
      if (!loadMore) setStatus('error')
    } finally {
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    void loadActivities()
  }, [])

  if (status === 'loading') return <div className="transactions-loading" aria-label="Načítání transakcí"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>

  if (status === 'error') {
    return <FeedbackState status="error" layout="panel" className="transactions-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Transakce se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={() => void loadActivities()}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
  }

  if (activities.length === 0) {
    return <EmptyState variant="quiet" size="lg" className="screen-placeholder"><EmptyStateIcon><ReceiptText aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Zatím bez transakcí</EmptyStateTitle><EmptyStateDescription>Přidej první příjem nebo výdaj.</EmptyStateDescription></EmptyState>
  }

  return <section className="transactions-screen" aria-label="Seznam transakcí">
    {groupActivities(activities).map(([date, items]) => <div className="transaction-day" key={date}><h2>{formatDate(date)}</h2><List gap="sm">{items.map((activity) => activity.kind === 'transaction' ? <TransactionRow key={activity.id} transaction={activity} onSelect={onSelectTransaction} /> : <TransferRow key={activity.id} transfer={activity} onSelect={onSelectTransfer} />)}</List></div>)}
    {nextCursor ? <Button variant="outline" className="transactions-load-more" loading={isLoadingMore} onClick={() => void loadActivities(true)}>Načíst další</Button> : null}
  </section>
}

function TransactionRow({ transaction, onSelect }: { transaction: Transaction; onSelect: (transaction: Transaction) => void }) {
  const amount = new Intl.NumberFormat('cs-CZ').format(transaction.amountCzk)
  return <ListItem variant="quiet" size="default" interactive className="transaction-row surface-row" onClick={() => onSelect(transaction)}><ListItemLeading className={`transaction-row__category color-key--${transaction.categoryColorKey}`}><CategoryIcon iconKey={transaction.categoryIconKey} colorKey={transaction.categoryColorKey} /></ListItemLeading><ListItemContent><ListItemTitle><span>{transaction.categoryName}</span><span className="transaction-row__wallet">v {transaction.walletName}</span></ListItemTitle>{transaction.labels.length > 0 ? <div className="transaction-row__labels">{transaction.labels.map((label) => <span key={label.id} className="transaction-row__label">{label.name}</span>)}</div> : null}{transaction.note ? <p className="transaction-row__note">{transaction.note}</p> : null}</ListItemContent><ListItemActions><strong className={transaction.direction === 'income' ? 'transaction-row__amount transaction-row__amount--income' : 'transaction-row__amount transaction-row__amount--expense'}>{transaction.direction === 'income' ? '+' : '-'}{amount} Kč</strong></ListItemActions></ListItem>
}

function TransferRow({ transfer, onSelect }: { transfer: Transfer; onSelect: (transfer: Transfer) => void }) {
  const amount = new Intl.NumberFormat('cs-CZ').format(transfer.amountCzk)
  return <ListItem variant="quiet" size="default" interactive className="transaction-row transfer-row surface-row" onClick={() => onSelect(transfer)}><ListItemLeading className="transfer-row__icon"><ArrowRightLeft aria-hidden="true" /></ListItemLeading><ListItemContent><ListItemTitle><span>Převod</span><span className="transaction-row__wallet">z {transfer.sourceWalletName} do {transfer.destinationWalletName}</span></ListItemTitle>{transfer.labels.length > 0 ? <div className="transaction-row__labels">{transfer.labels.map((label) => <span key={label.id} className="transaction-row__label">{label.name}</span>)}</div> : null}{transfer.note ? <p className="transaction-row__note">{transfer.note}</p> : null}</ListItemContent><ListItemActions><strong className="transfer-row__amount">{amount} Kč</strong></ListItemActions></ListItem>
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
