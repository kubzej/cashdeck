import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from './ui/button'
import './screen-header.css'

export function ScreenHeader({ title, titleId, backLabel, onBack, action }: { title: string; titleId?: string; backLabel: string; onBack: () => void; action?: ReactNode }) {
  return (
    <header className="screen-header">
      <Button variant="ghost" size="icon" aria-label={backLabel} onClick={onBack}><ArrowLeft aria-hidden="true" /></Button>
      <h1 id={titleId}>{title}</h1>
      {action ?? <span aria-hidden="true" />}
    </header>
  )
}
