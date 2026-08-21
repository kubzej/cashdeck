import { CircleAlert } from 'lucide-react'
import { Button } from './ui/button'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from './ui/feedback-state'

export function FormLoadError({ onRetry }: { onRetry: () => void }) {
  return <FeedbackState status="error" layout="panel">
    <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
    <FeedbackStateContent>
      <FeedbackStateTitle>Formulář se nepodařilo načíst</FeedbackStateTitle>
      <FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription>
    </FeedbackStateContent>
    <Button variant="outline" onClick={onRetry}>Zkusit znovu</Button>
  </FeedbackState>
}
