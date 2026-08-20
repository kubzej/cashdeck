import { useState, type ComponentType } from 'react'
import { BarChart3, LogOut, Plus, ReceiptText, Settings2, WalletCards } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { Button } from '../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../components/ui/empty-state'
import { type Wallet } from '../features/wallets/api'
import { WalletDetailScreen } from '../features/wallets/wallet-detail-screen'
import { WalletFormScreen } from '../features/wallets/wallet-form-screen'
import { WalletsScreen } from '../features/wallets/wallets-screen'

type NavKey = 'transactions' | 'wallets' | 'overview' | 'settings'
type NavItem = { key: NavKey; label: string; icon: ComponentType<{ 'aria-hidden'?: boolean }> }
type WalletView = 'list' | 'new' | 'detail' | 'edit'

const navItems: NavItem[] = [
  { key: 'transactions', label: 'Transakce', icon: ReceiptText },
  { key: 'wallets', label: 'Peněženky', icon: WalletCards },
  { key: 'overview', label: 'Přehled', icon: BarChart3 },
  { key: 'settings', label: 'Nastavení', icon: Settings2 },
]

const placeholders = {
  transactions: { title: 'Zatím bez transakcí', description: 'První záznamy se zobrazí tady.' },
  overview: { title: 'Zatím bez přehledu', description: 'Přehled se zobrazí po přidání prvních záznamů.' },
}

export function AppShell() {
  const { session, status, signOut } = useAuth()
  const [activeNav, setActiveNav] = useState<NavKey>('transactions')
  const [walletView, setWalletView] = useState<WalletView>('list')
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)
  const activeItem = navItems.find((item) => item.key === activeNav)
  const isWalletDetail = activeNav === 'wallets' && walletView !== 'list'

  function selectNavigation(key: NavKey) {
    setActiveNav(key)
    if (key !== 'wallets') {
      setWalletView('list')
      setSelectedWallet(null)
    }
  }

  if (status !== 'signed-in') return null

  return (
    <div className="app-shell">
      <div className="app-main">
        <main className={`app-content${isWalletDetail ? ' app-content--form' : ''}`}>
          {walletView === 'new' ? <WalletFormScreen onCancel={() => setWalletView('list')} onSaved={() => setWalletView('list')} /> : null}
          {walletView === 'detail' && selectedWallet ? <WalletDetailScreen wallet={selectedWallet} onBack={() => setWalletView('list')} onEdit={() => setWalletView('edit')} /> : null}
          {walletView === 'edit' && selectedWallet ? <WalletFormScreen wallet={selectedWallet} onCancel={() => setWalletView('detail')} onSaved={() => setWalletView('list')} onDeleted={() => { setSelectedWallet(null); setWalletView('list') }} /> : null}
          {!isWalletDetail ? <>
            <div className={`screen-heading${activeNav === 'wallets' ? ' screen-heading--action' : ''}`}>
              <h1>{activeItem?.label}</h1>
              {activeNav === 'wallets' ? <Button variant="ghost" size="icon" aria-label="Přidat peněženku" onClick={() => setWalletView('new')}><Plus aria-hidden="true" /></Button> : null}
            </div>
            {activeNav === 'settings' ? <SettingsScreen email={session?.user.email ?? ''} onSignOut={signOut} /> : activeNav === 'wallets' ? <WalletsScreen onCreate={() => setWalletView('new')} onSelect={(wallet) => { setSelectedWallet(wallet); setWalletView('detail') }} /> : activeItem ? <PlaceholderScreen item={activeItem} /> : null}
          </> : null}
        </main>
        {!isWalletDetail ? <nav className="bottom-nav" aria-label="Hlavní navigace">{navItems.map(({ key, label, icon: Icon }) => <Button key={key} variant="ghost" size="sm" className={`bottom-nav__item${key === activeNav ? ' bottom-nav__item--active' : ''}`} aria-current={key === activeNav ? 'page' : undefined} onClick={() => selectNavigation(key)}><Icon aria-hidden={true} /><span>{label}</span></Button>)}</nav> : null}
      </div>
    </div>
  )
}

function PlaceholderScreen({ item }: { item: NavItem }) {
  const content = placeholders[item.key as keyof typeof placeholders]
  const Icon = item.icon
  return <EmptyState variant="quiet" size="lg" className="screen-placeholder"><EmptyStateIcon><Icon aria-hidden={true} /></EmptyStateIcon><EmptyStateTitle>{content.title}</EmptyStateTitle><EmptyStateDescription>{content.description}</EmptyStateDescription></EmptyState>
}

function SettingsScreen({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  return <section className="settings-screen" aria-label="Nastavení aplikace"><section className="settings-section" aria-labelledby="session-title"><div className="settings-section__heading"><h2 id="session-title">Účet</h2></div><div className="settings-account" aria-label="Přihlášený účet"><span className="settings-account__label">Přihlášený e-mail</span><span className="settings-account__email">{email}</span></div><Button variant="outline" className="settings-sign-out" onClick={() => void onSignOut()}><LogOut aria-hidden="true" />Odhlásit se</Button></section></section>
}
