import { CircleAlert } from 'lucide-react'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from './ui/feedback-state'

const verbs = { save: 'uložit', edit: 'upravit', delete: 'smazat' } as const

export type SubmissionAction = keyof typeof verbs

/** The inline error a record form shows when saving, editing or deleting it failed: "<subject> se nepodařilo <verb>". */
export function FormSubmissionError({ subject, action, message }: { subject: string; action: SubmissionAction; message: string }) {
  return <FeedbackState status="error" layout="inline">
    <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
    <FeedbackStateContent>
      <FeedbackStateTitle>{`${subject} se nepodařilo ${verbs[action]}`}</FeedbackStateTitle>
      <FeedbackStateDescription>{message}</FeedbackStateDescription>
    </FeedbackStateContent>
  </FeedbackState>
}
