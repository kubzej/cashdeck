import { useEffect, useState } from 'react'
import {
  BarChart3,
  CircleAlert,
  LogOut,
  Moon,
  ReceiptText,
  RefreshCw,
  Settings2,
  Sun,
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
import './App.css'

type Theme = 'light' | 'dark'
type NavKey = 'transactions' | 'wallets' | 'overview' | 'settings'

type NavItem = {
  key: NavKey
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { key: 'transactions', label: 'Transakce', icon: ReceiptText },
  { key: 'wallets', label: 'Peněženky', icon: WalletCards },
  { key: 'overview', label: 'Přehled', icon: BarChart3 },
  { key: 'settings', label: 'Nastavení', icon: Settings2 },
]

function getInitialTheme(): Theme {
  return localStorage.getItem('cashdeck-theme') === 'dark' ? 'dark' : 'light'
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('cashdeck-theme', theme)
  }, [theme])

  return (
    <AuthProvider>
      <AuthGate theme={theme} setTheme={setTheme} />
    </AuthProvider>
  )
}

function AuthGate({ theme, setTheme }: { theme: Theme; setTheme: (theme: Theme) => void }) {
  const { status, errorMessage, refreshSession } = useAuth()

  if (status === 'loading') return <AuthLoadingState />
  if (status === 'unavailable') return <AuthUnavailableState />
  if (status === 'error') return <AuthErrorState message={errorMessage} onRetry={refreshSession} />
  if (status === 'signed-out') return <LoginScreen />

  return <AppShell theme={theme} setTheme={setTheme} />
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

function AppShell({ theme, setTheme }: { theme: Theme; setTheme: (theme: Theme) => void }) {
  const { status, signOut } = useAuth()
  const [activeNav, setActiveNav] = useState<NavKey>('transactions')

  if (status !== 'signed-in') return null

  return (
    <div className="app-shell">
      <div className="app-main">
        <header className="app-header">
          <div className="brand-lockup">
            <img src="/cashdeck-mark.svg" alt="" className="brand-mark" />
            <div>
              <p className="brand-name">Cashdeck</p>
              <p className="brand-context">Osobní finance</p>
            </div>
          </div>
          <div className="app-header-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === 'dark' ? 'Přepnout na světlý motiv' : 'Přepnout na tmavý motiv'}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Odhlásit se" onClick={() => void signOut()}>
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </header>

        <main className="app-content">
          <div className="screen-heading">
            <p className="eyebrow">Přehled</p>
            <h1>{navItems.find((item) => item.key === activeNav)?.label}</h1>
          </div>

          <FoundationPanel />
        </main>

        <nav className="bottom-nav" aria-label="Hlavní navigace">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = key === activeNav

            return (
              <Button
                key={key}
                variant={isActive ? 'secondary' : 'ghost'}
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

function FoundationPanel() {
  return (
    <section className="foundation-panel" aria-labelledby="foundation-title">
      <div className="foundation-panel__intro">
        <div className="foundation-icon" aria-hidden="true">
          <ReceiptText />
        </div>
        <div>
          <h2 id="foundation-title">Obsah se připravuje</h2>
          <p>Základní shell je připravený pro novou bezpečnou datovou vrstvu.</p>
        </div>
      </div>

      <div className="foundation-skeleton" aria-label="Připravený obsah">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </section>
  )
}

export default App
