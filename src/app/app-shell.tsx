import { useState, type ComponentType } from 'react'
import { BarChart3, Plus, ReceiptText, Settings2, WalletCards } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { Button } from '../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../components/ui/empty-state'
import { CategoriesScreen } from '../features/categories/categories-screen'
import { LabelsScreen } from '../features/labels/labels-screen'
import { SettingsScreen } from '../features/settings/settings-screen'
import { TransactionFormScreen } from '../features/transactions/transaction-form-screen'
import { AddActivityDialog } from '../features/transactions/add-activity-dialog'
import { type Transaction } from '../features/transactions/api'
import { TransactionsScreen } from '../features/transactions/transactions-screen'
import { TransferFormScreen } from '../features/transfers/transfer-form-screen'
import { type Transfer } from '../features/transfers/api'
import { type Wallet } from '../features/wallets/api'
import { WalletDetailScreen } from '../features/wallets/wallet-detail-screen'
import { WalletFormScreen } from '../features/wallets/wallet-form-screen'
import { WalletsScreen } from '../features/wallets/wallets-screen'

type NavKey = 'transactions' | 'wallets' | 'overview' | 'settings'
type NavItem = { key: NavKey; label: string; icon: ComponentType<{ 'aria-hidden'?: boolean }> }
type WalletView = 'list' | 'new' | 'detail' | 'edit'
type SettingsView = 'index' | 'categories' | 'labels'
type TransactionView = 'list' | 'new' | 'edit'
type TransferView = 'list' | 'new' | 'edit'

const navItems: NavItem[] = [
  { key: 'transactions', label: 'Transakce', icon: ReceiptText },
  { key: 'wallets', label: 'Peněženky', icon: WalletCards },
  { key: 'overview', label: 'Přehled', icon: BarChart3 },
  { key: 'settings', label: 'Nastavení', icon: Settings2 },
]

const placeholders = {
  overview: { title: 'Zatím bez přehledu', description: 'Přehled se zobrazí po přidání prvních záznamů.' },
}

export function AppShell() {
  const { status } = useAuth()
  const [activeNav, setActiveNav] = useState<NavKey>('transactions')
  const [walletView, setWalletView] = useState<WalletView>('list')
  const [transactionView, setTransactionView] = useState<TransactionView>('list')
  const [transferView, setTransferView] = useState<TransferView>('list')
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null)
  const [settingsView, setSettingsView] = useState<SettingsView>('index')
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false)
  const activeItem = navItems.find((item) => item.key === activeNav)
  const isDetailScreen = (activeNav === 'wallets' && walletView !== 'list') || (activeNav === 'transactions' && (transactionView !== 'list' || transferView !== 'list')) || (activeNav === 'settings' && settingsView !== 'index')

  function selectNavigation(key: NavKey) {
    setActiveNav(key)
    if (key !== 'wallets') {
      setWalletView('list')
      setSelectedWallet(null)
    }
    if (key !== 'transactions') {
      setTransactionView('list')
      setSelectedTransaction(null)
      setTransferView('list')
      setSelectedTransfer(null)
    }
    if (key !== 'settings') setSettingsView('index')
  }

  if (status !== 'signed-in') return null

  return (
    <div className="app-shell">
      <div className="app-main">
        <main className={`app-content${isDetailScreen ? ' app-content--form' : ''}${!isDetailScreen && activeNav === 'transactions' ? ' app-content--transaction-fab' : ''}`}>
          {walletView === 'new' ? <WalletFormScreen onCancel={() => setWalletView('list')} onSaved={() => setWalletView('list')} /> : null}
          {walletView === 'detail' && selectedWallet ? <WalletDetailScreen wallet={selectedWallet} onBack={() => setWalletView('list')} onEdit={() => setWalletView('edit')} /> : null}
          {walletView === 'edit' && selectedWallet ? <WalletFormScreen wallet={selectedWallet} onCancel={() => setWalletView('detail')} onSaved={() => setWalletView('list')} onDeleted={() => { setSelectedWallet(null); setWalletView('list') }} /> : null}
          {transactionView === 'new' ? <TransactionFormScreen onCancel={() => setTransactionView('list')} onSaved={() => setTransactionView('list')} /> : null}
          {transactionView === 'edit' && selectedTransaction ? <TransactionFormScreen transaction={selectedTransaction} onCancel={() => setTransactionView('list')} onSaved={() => { setSelectedTransaction(null); setTransactionView('list') }} onDeleted={() => { setSelectedTransaction(null); setTransactionView('list') }} /> : null}
          {transferView === 'new' ? <TransferFormScreen onCancel={() => setTransferView('list')} onSaved={() => setTransferView('list')} /> : null}
          {transferView === 'edit' && selectedTransfer ? <TransferFormScreen transfer={selectedTransfer} onCancel={() => setTransferView('list')} onSaved={() => { setSelectedTransfer(null); setTransferView('list') }} onDeleted={() => { setSelectedTransfer(null); setTransferView('list') }} /> : null}
          {activeNav === 'settings' && settingsView === 'categories' ? <CategoriesScreen onBack={() => setSettingsView('index')} /> : null}
          {activeNav === 'settings' && settingsView === 'labels' ? <LabelsScreen onBack={() => setSettingsView('index')} /> : null}
          {!isDetailScreen ? <>
            <div className={`screen-heading${activeNav === 'wallets' ? ' screen-heading--action' : ''}`}>
              <h1>{activeItem?.label}</h1>
              {activeNav === 'wallets' ? <Button variant="ghost" size="icon" aria-label="Přidat peněženku" onClick={() => setWalletView('new')}><Plus aria-hidden="true" /></Button> : null}
            </div>
            {activeNav === 'settings' ? <SettingsScreen onOpenCategories={() => setSettingsView('categories')} onOpenLabels={() => setSettingsView('labels')} /> : activeNav === 'wallets' ? <WalletsScreen onCreate={() => setWalletView('new')} onSelect={(wallet) => { setSelectedWallet(wallet); setWalletView('detail') }} /> : activeNav === 'transactions' ? <TransactionsScreen onSelectTransaction={(transaction) => { setSelectedTransaction(transaction); setTransactionView('edit') }} onSelectTransfer={(transfer) => { setSelectedTransfer(transfer); setTransferView('edit') }} /> : activeItem ? <PlaceholderScreen item={activeItem} /> : null}
          </> : null}
        </main>
        {!isDetailScreen && activeNav === 'transactions' ? <Button size="icon" className="transaction-fab" aria-label="Přidat záznam" onClick={() => setIsAddActivityOpen(true)}><Plus aria-hidden="true" /></Button> : null}
        {!isDetailScreen ? <nav className="bottom-nav" aria-label="Hlavní navigace">{navItems.map(({ key, label, icon: Icon }) => <Button key={key} variant="ghost" size="sm" className={`bottom-nav__item${key === activeNav ? ' bottom-nav__item--active' : ''}`} aria-current={key === activeNav ? 'page' : undefined} onClick={() => selectNavigation(key)}><Icon aria-hidden={true} /><span>{label}</span></Button>)}</nav> : null}
        <AddActivityDialog open={isAddActivityOpen} onOpenChange={setIsAddActivityOpen} onCreateTransaction={() => setTransactionView('new')} onCreateTransfer={() => setTransferView('new')} />
      </div>
    </div>
  )
}

function PlaceholderScreen({ item }: { item: NavItem }) {
  const content = placeholders[item.key as keyof typeof placeholders]
  const Icon = item.icon
  return <EmptyState variant="quiet" size="lg" className="screen-placeholder"><EmptyStateIcon><Icon aria-hidden={true} /></EmptyStateIcon><EmptyStateTitle>{content.title}</EmptyStateTitle><EmptyStateDescription>{content.description}</EmptyStateDescription></EmptyState>
}
