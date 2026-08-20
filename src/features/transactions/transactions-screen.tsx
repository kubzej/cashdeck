import { useEffect, useState } from 'react'
import { CircleAlert, ReceiptText, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemLeading, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { CategoryIcon } from '../categories/category-icon'
import { listTransactions, type Transaction } from './api'
import './transactions.css'

export function TransactionsScreen({ onSelect }: { onSelect: (transaction: Transaction) => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  async function loadTransactions(cursor?: string) {
    if (cursor) setIsLoadingMore(true)
    else setStatus('loading')
    try {
      const page = await listTransactions({ cursor })
      setTransactions((current) => cursor ? [...current, ...page.items] : page.items)
      setNextCursor(page.nextCursor)
      setStatus('ready')
    } catch {
      if (!cursor) setStatus('error')
    } finally {
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    void loadTransactions()
  }, [])

  if (status === 'loading') return <div className="transactions-loading" aria-label="Načítání transakcí"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>

  if (status === 'error') {
    return <FeedbackState status="error" layout="panel" className="transactions-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Transakce se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={() => void loadTransactions()}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
  }

  if (transactions.length === 0) {
    return <EmptyState variant="quiet" size="lg" className="screen-placeholder"><EmptyStateIcon><ReceiptText aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Zatím bez transakcí</EmptyStateTitle><EmptyStateDescription>Přidej první příjem nebo výdaj.</EmptyStateDescription></EmptyState>
  }

  return <section className="transactions-screen" aria-label="Seznam transakcí">
    {groupTransactions(transactions).map(([date, items]) => <div className="transaction-day" key={date}><h2>{formatDate(date)}</h2><List gap="sm">{items.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onSelect={onSelect} />)}</List></div>)}
    {nextCursor ? <Button variant="outline" className="transactions-load-more" loading={isLoadingMore} onClick={() => void loadTransactions(nextCursor)}>Načíst další</Button> : null}
  </section>
}

function TransactionRow({ transaction, onSelect }: { transaction: Transaction; onSelect: (transaction: Transaction) => void }) {
  const amount = new Intl.NumberFormat('cs-CZ').format(transaction.amountCzk)
  return <ListItem variant="quiet" size="default" interactive className="transaction-row surface-row" onClick={() => onSelect(transaction)}><ListItemLeading className={`transaction-row__category color-key--${transaction.categoryColorKey}`}><CategoryIcon iconKey={transaction.categoryIconKey} colorKey={transaction.categoryColorKey} /></ListItemLeading><ListItemContent><ListItemTitle><span>{transaction.categoryName}</span><span className="transaction-row__wallet">v {transaction.walletName}</span></ListItemTitle>{transaction.labels.length > 0 ? <div className="transaction-row__labels">{transaction.labels.map((label) => <span key={label.id} className="transaction-row__label">{label.name}</span>)}</div> : null}{transaction.note ? <p className="transaction-row__note">{transaction.note}</p> : null}</ListItemContent><ListItemActions><strong className={transaction.direction === 'income' ? 'transaction-row__amount transaction-row__amount--income' : 'transaction-row__amount transaction-row__amount--expense'}>{transaction.direction === 'income' ? '+' : '-'}{amount} Kč</strong></ListItemActions></ListItem>
}

function groupTransactions(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>()
  for (const transaction of transactions) {
    const group = groups.get(transaction.transactionDate) ?? []
    group.push(transaction)
    groups.set(transaction.transactionDate, group)
  }
  return [...groups.entries()]
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}
