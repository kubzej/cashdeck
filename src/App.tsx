import { useEffect, useState } from 'react'
import {
  BarChart3,
  Moon,
  ReceiptText,
  Settings2,
  Sun,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { Button } from './components/ui/button'
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
  const [activeNav, setActiveNav] = useState<NavKey>('transactions')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('cashdeck-theme', theme)
  }, [theme])

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
          <Button
            variant="ghost"
            size="icon"
            aria-label={theme === 'dark' ? 'Přepnout na světlý motiv' : 'Přepnout na tmavý motiv'}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </header>

        <main className="app-content">
          <div className="screen-heading">
            <p className="eyebrow">Přehled</p>
            <h1>{navItems.find((item) => item.key === activeNav)?.label}</h1>
          </div>

          <section className="foundation-panel" aria-labelledby="foundation-title">
            <div className="foundation-panel__intro">
              <div className="foundation-icon" aria-hidden="true">
                <ReceiptText />
              </div>
              <div>
                <h2 id="foundation-title">Cashdeck je připravený</h2>
                <p>Foundation shell pro další fáze projektu.</p>
              </div>
            </div>

            <div className="foundation-skeleton" aria-label="Načítání obsahu">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </section>
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

export default App
