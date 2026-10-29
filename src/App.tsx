import { AuthProvider } from './auth/auth-provider'
import { AuthGate } from './app/auth-gate'
import { ErrorBoundary } from './app/error-boundary'
import './App.css'

export default function App() {
  return <ErrorBoundary layout="page"><AuthProvider><AuthGate /></AuthProvider></ErrorBoundary>
}
