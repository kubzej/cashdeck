import { useEffect, useState } from 'react'
import { ArrowRightLeft, CircleAlert, ReceiptText, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemLeading, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { CategoryIcon } from '../categories/category-icon'
import { listTransactions, type Transaction } from './api'
import { listTransfers, type Transfer } from '../transfers/api'
import './transactions.css'

type Activity = { kind: 'transaction'; item: Transaction } | { kind: 'transfer'; item: Transfer }

export function TransactionsScreen({ onSelectTransaction, onSelectTransfer }: { onSelectTransaction: (transaction: Transaction) => void; onSelectTransfer: (transfer: Transfer) => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [nextTransactionCursor, setNextTransactionCursor] = useState<string | null>(null)
  const [nextTransferCursor, setNextTransferCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  async function loadActivities(loadMore = false) {
    if (loadMore) setIsLoadingMore(true)
    else setStatus('loading')
    try {
      const [transactionPage, transferPage] = await Promise.all([
        loadMore && !nextTransactionCursor ? null : listTransactions({ cursor: loadMore ? nextTransactionCursor ?? undefined : undefined }),
        loadMore && !nextTransferCursor ? null : listTransfers({ cursor: loadMore ? nextTransferCursor ?? undefined : undefined }),
      ])
      if (transactionPage) {
        setTransactions((current) => loadMore ? [...current, ...transactionPage.items] : transactionPage.items)
        setNextTransactionCursor(transactionPage.nextCursor)
      }
      if (transferPage) {
        setTransfers((current) => loadMore ? [...current, ...transferPage.items] : transferPage.items)
        setNextTransferCursor(transferPage.nextCursor)
      }
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

  const activities = sortActivities(transactions, transfers)

  if (activities.length === 0) {
    return <EmptyState variant="quiet" size="lg" className="screen-placeholder"><EmptyStateIcon><ReceiptText aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Zatím bez transakcí</EmptyStateTitle><EmptyStateDescription>Přidej první příjem nebo výdaj.</EmptyStateDescription></EmptyState>
  }

  return <section className="transactions-screen" aria-label="Seznam transakcí">
    {groupActivities(activities).map(([date, items]) => <div className="transaction-day" key={date}><h2>{formatDate(date)}</h2><List gap="sm">{items.map((activity) => activity.kind === 'transaction' ? <TransactionRow key={activity.item.id} transaction={activity.item} onSelect={onSelectTransaction} /> : <TransferRow key={activity.item.id} transfer={activity.item} onSelect={onSelectTransfer} />)}</List></div>)}
    {nextTransactionCursor || nextTransferCursor ? <Button variant="outline" className="transactions-load-more" loading={isLoadingMore} onClick={() => void loadActivities(true)}>Načíst další</Button> : null}
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

function sortActivities(transactions: Transaction[], transfers: Transfer[]) {
  return [...transactions.map((item) => ({ kind: 'transaction' as const, item })), ...transfers.map((item) => ({ kind: 'transfer' as const, item }))].sort((left, right) => activityDate(right).localeCompare(activityDate(left)))
}

function groupActivities(activities: Activity[]) {
  const groups = new Map<string, Activity[]>()
  for (const activity of activities) {
    const date = activityDate(activity)
    const group = groups.get(date) ?? []
    group.push(activity)
    groups.set(date, group)
  }
  return [...groups.entries()]
}

function activityDate(activity: Activity) { return activity.kind === 'transaction' ? activity.item.transactionDate : activity.item.transferDate }

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}
