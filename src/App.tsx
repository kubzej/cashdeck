import { useState } from 'react'
import {
  BarChart3,
  CircleAlert,
  LogOut,
  ReceiptText,
  RefreshCw,
  Settings2,
  WalletCards,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { AuthProvider } from './auth/auth-provider'
import { LoginScreen } from './auth/login-screen'
import { useAuth } from './auth/auth-context'
import { Button } from './components/ui/button'
import {
  FeedbackState,
  FeedbackStateActions,
  FeedbackStateContent,
  FeedbackStateDescription,
  FeedbackStateIcon,
  FeedbackStateTitle,
} from './components/ui/feedback-state'
import { Skeleton } from './components/ui/skeleton'
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from './components/ui/empty-state'
import './App.css'

type NavKey = 'transactions' | 'wallets' | 'overview' | 'settings'

type NavItem = {
  key: NavKey
  label: string
  icon: LucideIcon
}

type PlaceholderContent = {
  title: string
  description: string
}

const navItems: NavItem[] = [
  { key: 'transactions', label: 'Transakce', icon: ReceiptText },
  { key: 'wallets', label: 'Peněženky', icon: WalletCards },
  { key: 'overview', label: 'Přehled', icon: BarChart3 },
  { key: 'settings', label: 'Nastavení', icon: Settings2 },
]

const placeholderContent: Record<Exclude<NavKey, 'settings'>, PlaceholderContent> = {
  transactions: {
    title: 'Zatím bez transakcí',
    description: 'První záznamy se zobrazí tady.',
  },
  wallets: {
    title: 'Zatím bez peněženek',
    description: 'Přidané peněženky se zobrazí tady.',
  },
  overview: {
    title: 'Zatím bez přehledu',
    description: 'Přehled se zobrazí po přidání prvních záznamů.',
  },
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

function AuthGate() {
  const { status, errorMessage, refreshSession } = useAuth()

  if (status === 'loading') return <AuthLoadingState />
  if (status === 'unavailable') return <AuthUnavailableState />
  if (status === 'error') return <AuthErrorState message={errorMessage} onRetry={refreshSession} />
  if (status === 'signed-out') return <LoginScreen />

  return <AppShell />
}

function AuthLoadingState() {
  return (
    <main className="auth-state-screen" aria-label="Načítání přihlášení">
      <div className="auth-state-panel">
        <Skeleton shape="circle" className="auth-state-icon" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
    </main>
  )
}

function AuthUnavailableState() {
  return (
    <main className="auth-state-screen">
      <FeedbackState status="error" layout="panel" className="auth-state-feedback">
        <FeedbackStateIcon><WifiOff aria-hidden="true" /></FeedbackStateIcon>
        <FeedbackStateContent>
          <FeedbackStateTitle>Nelze načíst přihlášení</FeedbackStateTitle>
          <FeedbackStateDescription>Neon Auth není pro toto prostředí nastavený.</FeedbackStateDescription>
        </FeedbackStateContent>
      </FeedbackState>
    </main>
  )
}

function AuthErrorState({ message, onRetry }: { message: string | null; onRetry: () => Promise<void> }) {
  return (
    <main className="auth-state-screen">
      <FeedbackState status="error" layout="panel" className="auth-state-feedback">
        <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
        <FeedbackStateContent>
          <FeedbackStateTitle>Přihlášení není dostupné</FeedbackStateTitle>
          <FeedbackStateDescription>{message ?? 'Zkontroluj připojení a zkus to znovu.'}</FeedbackStateDescription>
        </FeedbackStateContent>
        <FeedbackStateActions>
          <Button variant="outline" onClick={() => void onRetry()}>
            <RefreshCw aria-hidden="true" />
            Zkusit znovu
          </Button>
        </FeedbackStateActions>
      </FeedbackState>
    </main>
  )
}

function AppShell() {
  const { session, status, signOut } = useAuth()
  const [activeNav, setActiveNav] = useState<NavKey>('transactions')
  const activeItem = navItems.find((item) => item.key === activeNav)

  if (status !== 'signed-in') return null

  return (
    <div className="app-shell">
      <div className="app-main">
        <main className="app-content">
          <div className="screen-heading">
            <h1>{activeItem?.label}</h1>
          </div>

          {activeNav === 'settings' ? (
            <SettingsScreen email={session?.user.email ?? ''} onSignOut={signOut} />
          ) : activeItem ? (
            <PlaceholderScreen item={activeItem} />
          ) : null}
        </main>

        <nav className="bottom-nav" aria-label="Hlavní navigace">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = key === activeNav

            return (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                className={`bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveNav(key)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function PlaceholderScreen({ item }: { item: NavItem }) {
  const content = placeholderContent[item.key as Exclude<NavKey, 'settings'>]
  const Icon = item.icon

  return (
    <EmptyState variant="quiet" size="lg" className="screen-placeholder">
      <EmptyStateIcon><Icon aria-hidden="true" /></EmptyStateIcon>
      <EmptyStateTitle>{content.title}</EmptyStateTitle>
      <EmptyStateDescription>{content.description}</EmptyStateDescription>
    </EmptyState>
  )
}

function SettingsScreen({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  return (
    <section className="settings-screen" aria-label="Nastavení aplikace">
      <section className="settings-section" aria-labelledby="session-title">
        <div className="settings-section__heading">
          <h2 id="session-title">Účet</h2>
        </div>
        <div className="settings-account" aria-label="Přihlášený účet">
          <span className="settings-account__label">Přihlášený e-mail</span>
          <span className="settings-account__email">{email}</span>
        </div>
        <Button variant="outline" className="settings-sign-out" onClick={() => void onSignOut()}>
          <LogOut aria-hidden="true" />
          Odhlásit se
        </Button>
      </section>
    </section>
  )
}

export default App
