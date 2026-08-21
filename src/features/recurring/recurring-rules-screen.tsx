import { useEffect, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, CalendarClock, CircleAlert, Plus, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { RecurringCostSummary } from './recurring-cost-summary'
import { RecurringRuleFormScreen } from './recurring-rule-form-screen'
import { SortableRecurringRuleRow } from './sortable-recurring-rule-row'
import { listRecurringRules, reorderRecurringRules, type RecurringRule } from './api'
import './recurring.css'

type RecurringView = 'list' | 'new' | 'edit'

export function RecurringRulesScreen({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<RecurringView>('list')
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedRule, setSelectedRule] = useState<RecurringRule | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    let cancelled = false
    async function loadRules() {
      setStatus('loading')
      try {
        const result = await listRecurringRules()
        if (!cancelled) {
          setRules(result)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void loadRules()
    return () => { cancelled = true }
  }, [reloadKey])

  function finishForm() {
    setSelectedRule(null)
    setView('list')
    setReloadKey((current) => current + 1)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = rules.findIndex((rule) => rule.id === active.id)
    const newIndex = rules.findIndex((rule) => rule.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const nextRules = [...rules]
    const [movedRule] = nextRules.splice(oldIndex, 1)
    nextRules.splice(newIndex, 0, movedRule)
    setIsReordering(true)
    setReorderError(null)

    try {
      await reorderRecurringRules(nextRules.map((rule) => rule.id))
      setRules(nextRules)
    } catch (error) {
      setReorderError(error instanceof Error ? error.message : 'Pořadí opakování se nepodařilo uložit.')
    } finally {
      setIsReordering(false)
    }
  }

  if (view === 'new') return <RecurringRuleFormScreen onCancel={() => setView('list')} onSaved={finishForm} />
  if (view === 'edit' && selectedRule) return <RecurringRuleFormScreen rule={selectedRule} onCancel={() => setView('list')} onSaved={finishForm} onDeleted={finishForm} />

  return <section className="recurring-screen" aria-labelledby="recurring-title">
    <header className="recurring-header">
      <Button variant="ghost" size="icon" aria-label="Zpět do nastavení" onClick={onBack}><ArrowLeft aria-hidden="true" /></Button>
      <h1 id="recurring-title">Opakování</h1>
      <Button variant="ghost" size="icon" aria-label="Přidat opakování" onClick={() => setView('new')}><Plus aria-hidden="true" /></Button>
    </header>
    {status === 'ready' ? <RecurringCostSummary rules={rules} /> : null}
    {reorderError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Pořadí se nepodařilo uložit</FeedbackStateTitle><FeedbackStateDescription>{reorderError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
    <RecurringRulePanel
      rules={rules}
      status={status}
      isReordering={isReordering}
      sensors={sensors}
      onDragEnd={(event) => void handleDragEnd(event)}
      onRetry={() => setReloadKey((current) => current + 1)}
      onSelect={(rule) => { setSelectedRule(rule); setView('edit') }}
    />
  </section>
}

function RecurringRulePanel({ rules, status, isReordering, sensors, onDragEnd, onRetry, onSelect }: {
  rules: RecurringRule[]
  status: 'loading' | 'ready' | 'error'
  isReordering: boolean
  sensors: ReturnType<typeof useSensors>
  onDragEnd: (event: DragEndEvent) => void
  onRetry: () => void
  onSelect: (rule: RecurringRule) => void
}) {
  if (status === 'loading') return <div className="recurring-loading" aria-label="Načítání opakování"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
  if (status === 'error') return <FeedbackState status="error" layout="panel" className="recurring-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Opakování se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
  if (rules.length === 0) return <EmptyState variant="quiet" size="lg" className="recurring-empty"><EmptyStateIcon><CalendarClock aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Bez opakování</EmptyStateTitle><EmptyStateDescription>Přidej pravidlo pro pravidelnou transakci nebo převod.</EmptyStateDescription></EmptyState>

  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
    <SortableContext items={rules.map((rule) => rule.id)} strategy={verticalListSortingStrategy}>
      <List gap="sm" className="recurring-list" aria-label="Seznam opakování">
        {rules.map((rule) => <SortableRecurringRuleRow key={rule.id} rule={rule} disabled={isReordering} onSelect={onSelect} />)}
      </List>
    </SortableContext>
  </DndContext>
}
