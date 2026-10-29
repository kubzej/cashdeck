import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../components/ui/feedback-state'

type ErrorBoundaryProps = {
  children: ReactNode
  // 'page' replaces the whole app, 'panel' only the area it wraps (the navigation stays usable).
  layout: 'page' | 'panel'
  // When this value changes after a failure, the boundary tries to render its children again.
  resetKey?: string
}

type ErrorBoundaryState = { failed: boolean; resetKey?: string }

/**
 * Without a boundary, an exception while rendering unmounts the whole React tree and leaves a
 * blank screen, which in an installed PWA has no address bar to recover from. The typical
 * trigger is a lazy screen whose file no longer exists after a deploy; reloading fetches the
 * current version.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true }
  }

  // Leaving the failed screen (the key changes) gives the children a fresh start.
  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Cashdeck screen failed to render', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    const feedback = <FeedbackState status="error" layout="panel" className="auth-state-feedback">
      <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
      <FeedbackStateContent>
        <FeedbackStateTitle>{this.props.layout === 'page' ? 'Cashdeck se nepodařilo zobrazit' : 'Tuto obrazovku se nepodařilo zobrazit'}</FeedbackStateTitle>
        <FeedbackStateDescription>Zkus aplikaci načíst znovu. Pokud se to opakuje, zavři ji a otevři znovu.</FeedbackStateDescription>
      </FeedbackStateContent>
      <FeedbackStateActions><Button variant="outline" onClick={() => window.location.reload()}><RefreshCw aria-hidden="true" />Načíst znovu</Button></FeedbackStateActions>
    </FeedbackState>

    return this.props.layout === 'page' ? <main className="auth-state-screen">{feedback}</main> : feedback
  }
}
