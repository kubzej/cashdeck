import { WifiOff } from 'lucide-react'
import { LoginScreen } from '../auth/login-screen'
import { useAuth } from '../auth/auth-context'
import { LoadError } from '../components/load-error'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../components/ui/feedback-state'
import { Skeleton } from '../components/ui/skeleton'
import { AppShell } from './app-shell'

export function AuthGate() {
  const { status, errorMessage, refreshSession } = useAuth()
  if (status === 'loading') return <AuthLoadingState />
  if (status === 'unavailable') return <AuthUnavailableState />
  if (status === 'error') return <AuthErrorState message={errorMessage} onRetry={refreshSession} />
  if (status === 'signed-out') return <LoginScreen />
  return <AppShell />
}

function AuthLoadingState() {
  return <main className="auth-state-screen" aria-label="Načítání přihlášení"><div className="auth-state-panel"><Skeleton shape="circle" className="auth-state-icon" /><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-64" /></div></main>
}

function AuthUnavailableState() {
  return <main className="auth-state-screen"><FeedbackState status="error" layout="panel" className="auth-state-feedback"><FeedbackStateIcon><WifiOff aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Nelze načíst přihlášení</FeedbackStateTitle><FeedbackStateDescription>Cashdeck API není pro toto prostředí nastavené.</FeedbackStateDescription></FeedbackStateContent></FeedbackState></main>
}

function AuthErrorState({ message, onRetry }: { message: string | null; onRetry: () => Promise<void> }) {
  return <main className="auth-state-screen"><LoadError title="Přihlášení není dostupné" description={message ?? 'Zkontroluj připojení a zkus to znovu.'} className="auth-state-feedback" onRetry={() => void onRetry()} /></main>
}
