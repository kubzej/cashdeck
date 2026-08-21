import { AuthProvider } from './auth/auth-provider'
import { AuthGate } from './app/auth-gate'
import './App.css'

export default function App() {
  return <AuthProvider><AuthGate /></AuthProvider>
}
