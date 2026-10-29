import { CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from './ui/feedback-state'

type LoadErrorProps = {
  title: string
  description?: string
  // 'panel' fills the area the content would have had; 'inline' is a compact row inside a card.
  layout?: 'panel' | 'inline'
  className?: string
  // Without it only the message is shown (e.g. next to a "load more" button that already retries).
  onRetry?: () => void
}

/** The error shown in place of content that could not be loaded; every screen uses this one. */
export function LoadError({ title, description = 'Zkus to prosím znovu.', layout = 'panel', className, onRetry }: LoadErrorProps) {
  return <FeedbackState status="error" layout={layout} className={className}>
    <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
    <FeedbackStateContent>
      <FeedbackStateTitle>{title}</FeedbackStateTitle>
      <FeedbackStateDescription>{description}</FeedbackStateDescription>
    </FeedbackStateContent>
    {onRetry ? <FeedbackStateActions>
      <Button variant="outline" onClick={onRetry}>{layout === 'panel' ? <RefreshCw aria-hidden="true" /> : null}Zkusit znovu</Button>
    </FeedbackStateActions> : null}
  </FeedbackState>
}
