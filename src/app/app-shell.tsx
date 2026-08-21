import { lazy, Suspense, useState, type ComponentType } from 'react'
import { BarChart3, Plus, ReceiptText, Settings2, WalletCards } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { Button } from '../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../components/ui/empty-state'
import { CategoriesScreen } from '../features/categories/categories-screen'
import { LabelsScreen } from '../features/labels/labels-screen'
import { PlannedScreen } from '../features/planned/planned-screen'
import { RecurringRulesScreen } from '../features/recurring/recurring-rules-screen'
import { SettingsScreen } from '../features/settings/settings-screen'
import { TransactionFormScreen } from '../features/transactions/transaction-form-screen'
import { AddActivityDialog } from '../features/transactions/add-activity-dialog'
import { type Transaction } from '../features/transactions/api'
import { TransactionsScreen } from '../features/transactions/transactions-screen'
import type { FeedFilterValue } from '../features/feed/feed-filters'
import { TransferFormScreen } from '../features/transfers/transfer-form-screen'
import { type Transfer } from '../features/transfers/api'
import { type Wallet } from '../features/wallets/api'
import { WalletFormScreen } from '../features/wallets/wallet-form-screen'
import { WalletsScreen } from '../features/wallets/wallets-screen'
import type { OverviewSelection } from '../features/overview/overview-screen'

const OverviewScreen = lazy(() => import('../features/overview/overview-screen').then((module) => ({ default: module.OverviewScreen })))

type NavKey = 'transactions' | 'wallets' | 'overview' | 'settings'
type NavItem = { key: NavKey; label: string; icon: ComponentType<{ 'aria-hidden'?: boolean }> }
type WalletView = 'list' | 'new' | 'edit'
type SettingsView = 'index' | 'categories' | 'labels' | 'recurring'
type TransactionView = 'list' | 'new' | 'edit' | 'planned'
type TransferView = 'list' | 'new' | 'edit'

const navItems: NavItem[] = [
  { key: 'transactions', label: 'Transakce', icon: ReceiptText },
  { key: 'wallets', label: 'Peněženky', icon: WalletCards },
  { key: 'overview', label: 'Přehled', icon: BarChart3 },
  { key: 'settings', label: 'Nastavení', icon: Settings2 },
]

export function AppShell() {
  const { status } = useAuth()
  const [activeNav, setActiveNav] = useState<NavKey>('transactions')
  const [walletView, setWalletView] = useState<WalletView>('list')
  const [transactionView, setTransactionView] = useState<TransactionView>('list')
  const [transferView, setTransferView] = useState<TransferView>('list')
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)
  const [transactionWalletId, setTransactionWalletId] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null)
  const [plannedFilters, setPlannedFilters] = useState<FeedFilterValue | null>(null)
  const [feedSelection, setFeedSelection] = useState<OverviewSelection | null>(null)
  const [transactionReturnView, setTransactionReturnView] = useState<'list' | 'planned'>('list')
  const [settingsView, setSettingsView] = useState<SettingsView>('index')
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false)
  const activeItem = navItems.find((item) => item.key === activeNav)
  const isDetailScreen = (activeNav === 'wallets' && walletView !== 'list') || (activeNav === 'transactions' && (transactionView !== 'list' || transferView !== 'list')) || (activeNav === 'settings' && settingsView !== 'index')

  function selectNavigation(key: NavKey) {
    setActiveNav(key)
    if (key === 'transactions') {
      setTransactionWalletId(null)
      setPlannedFilters(null)
      setFeedSelection(null)
    }
    if (key !== 'wallets') {
      setWalletView('list')
      setSelectedWallet(null)
    }
    if (key !== 'transactions') {
      setTransactionView('list')
      setSelectedTransaction(null)
      setTransferView('list')
      setSelectedTransfer(null)
      setTransactionReturnView('list')
    }
    if (key !== 'settings') setSettingsView('index')
  }

  if (status !== 'signed-in') return null

  return (
    <div className="app-shell">
      <div className="app-main">
        <main className={`app-content${isDetailScreen ? ' app-content--form' : ''}${!isDetailScreen && activeNav === 'transactions' ? ' app-content--transaction-fab' : ''}`}>
          {walletView === 'new' ? <WalletFormScreen onCancel={() => setWalletView('list')} onSaved={() => setWalletView('list')} /> : null}
          {walletView === 'edit' && selectedWallet ? <WalletFormScreen wallet={selectedWallet} onCancel={() => setWalletView('list')} onSaved={() => setWalletView('list')} onDeleted={() => { setSelectedWallet(null); setWalletView('list') }} /> : null}
          {transactionView === 'new' ? <TransactionFormScreen onCancel={() => setTransactionView('list')} onSaved={() => setTransactionView('list')} /> : null}
          {transactionView === 'edit' && selectedTransaction ? <TransactionFormScreen transaction={selectedTransaction} onCancel={() => setTransactionView(transactionReturnView)} onSaved={() => { setSelectedTransaction(null); setTransactionView(transactionReturnView) }} onDeleted={() => { setSelectedTransaction(null); setTransactionView(transactionReturnView) }} /> : null}
          {transferView === 'new' ? <TransferFormScreen onCancel={() => setTransferView('list')} onSaved={() => setTransferView('list')} /> : null}
          {transferView === 'edit' && selectedTransfer ? <TransferFormScreen transfer={selectedTransfer} onCancel={() => { setSelectedTransfer(null); setTransferView('list') }} onSaved={() => { setSelectedTransfer(null); setTransferView('list') }} onDeleted={() => { setSelectedTransfer(null); setTransferView('list') }} /> : null}
          {transactionView === 'planned' && transferView === 'list' && plannedFilters ? <PlannedScreen filters={plannedFilters} selection={feedSelection ?? undefined} onBack={() => setTransactionView('list')} onSelectTransaction={(transaction) => { setSelectedTransaction(transaction); setTransactionReturnView('planned'); setTransactionView('edit') }} onSelectTransfer={(transfer) => { setSelectedTransfer(transfer); setTransactionReturnView('planned'); setTransferView('edit') }} /> : null}
          {activeNav === 'settings' && settingsView === 'categories' ? <CategoriesScreen onBack={() => setSettingsView('index')} /> : null}
          {activeNav === 'settings' && settingsView === 'labels' ? <LabelsScreen onBack={() => setSettingsView('index')} /> : null}
          {activeNav === 'settings' && settingsView === 'recurring' ? <RecurringRulesScreen onBack={() => setSettingsView('index')} /> : null}
          {!isDetailScreen ? <>
            <div className={`screen-heading${activeNav === 'wallets' ? ' screen-heading--action' : ''}`}>
              <h1>{activeItem?.label}</h1>
              {activeNav === 'wallets' ? <Button variant="ghost" size="icon" aria-label="Přidat peněženku" onClick={() => setWalletView('new')}><Plus aria-hidden="true" /></Button> : null}
            </div>
          {activeNav === 'settings' ? <SettingsScreen onOpenCategories={() => setSettingsView('categories')} onOpenLabels={() => setSettingsView('labels')} onOpenRecurring={() => setSettingsView('recurring')} /> : activeNav === 'wallets' ? <WalletsScreen onCreate={() => setWalletView('new')} onSelect={(wallet) => { setPlannedFilters(null); setFeedSelection(null); setTransactionWalletId(wallet.id); setActiveNav('transactions') }} onManage={(wallet) => { setSelectedWallet(wallet); setWalletView('edit') }} /> : activeNav === 'transactions' ? <TransactionsScreen initialWalletId={transactionWalletId ?? undefined} initialFilters={plannedFilters ?? undefined} fixedSelection={feedSelection ?? undefined} onResetFilters={() => { setTransactionWalletId(null); setPlannedFilters(null); setFeedSelection(null) }} onOpenPlanned={(filters) => { setPlannedFilters(filters); setTransactionView('planned') }} onSelectTransaction={(transaction) => { setSelectedTransaction(transaction); setTransactionReturnView('list'); setTransactionView('edit') }} onSelectTransfer={(transfer) => { setSelectedTransfer(transfer); setTransactionReturnView('list'); setTransferView('edit') }} /> : activeNav === 'overview' ? <Suspense fallback={<OverviewRouteSkeleton />}><OverviewScreen onOpenTransactions={(filters, selection) => { setPlannedFilters(filters); setFeedSelection(selection); setTransactionWalletId(null); setActiveNav('transactions') }} /></Suspense> : null}
          </> : null}
        </main>
        {!isDetailScreen && activeNav === 'transactions' ? <Button size="icon" className="transaction-fab" aria-label="Přidat záznam" onClick={() => setIsAddActivityOpen(true)}><Plus aria-hidden="true" /></Button> : null}
        {!isDetailScreen ? <nav className="bottom-nav" aria-label="Hlavní navigace">{navItems.map(({ key, label, icon: Icon }) => <Button key={key} variant="ghost" size="sm" className={`bottom-nav__item${key === activeNav ? ' bottom-nav__item--active' : ''}`} aria-current={key === activeNav ? 'page' : undefined} onClick={() => selectNavigation(key)}><Icon aria-hidden={true} /><span>{label}</span></Button>)}</nav> : null}
        <AddActivityDialog open={isAddActivityOpen} onOpenChange={setIsAddActivityOpen} onCreateTransaction={() => setTransactionView('new')} onCreateTransfer={() => setTransferView('new')} />
      </div>
    </div>
  )
}

function OverviewRouteSkeleton() { return <EmptyState variant="quiet" size="lg" className="screen-placeholder"><EmptyStateIcon><BarChart3 aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Načítám přehled</EmptyStateTitle><EmptyStateDescription>Připravuji souhrn financí.</EmptyStateDescription></EmptyState> }
