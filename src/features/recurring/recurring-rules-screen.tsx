import { useEffect, useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent, type useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CalendarClock, CircleAlert, Plus } from 'lucide-react'
import { LoadError } from '../../components/load-error'
import { Button } from '../../components/ui/button'
import { ScreenHeader } from '../../components/screen-header'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { useSortableList } from '../../lib/sortable-list'
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
  const { sensors, isReordering, handleDragEnd: reorderByDrag } = useSortableList({
    onStart: () => setReorderError(null),
    onError: (error) => setReorderError(error instanceof Error ? error.message : 'Pořadí opakování se nepodařilo uložit.'),
  })

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
    await reorderByDrag(event, rules, async (nextRules) => {
      await reorderRecurringRules(nextRules.map((rule) => rule.id))
      setRules(nextRules)
    })
  }

  if (view === 'new') return <RecurringRuleFormScreen onCancel={() => setView('list')} onSaved={finishForm} />
  if (view === 'edit' && selectedRule) return <RecurringRuleFormScreen rule={selectedRule} onCancel={() => setView('list')} onSaved={finishForm} onDeleted={finishForm} />

  return <section className="recurring-screen" aria-labelledby="recurring-title">
    <ScreenHeader
      title="Opakování"
      titleId="recurring-title"
      backLabel="Zpět do nastavení"
      onBack={onBack}
      action={<Button variant="ghost" size="icon" aria-label="Přidat opakování" onClick={() => setView('new')}><Plus aria-hidden="true" /></Button>}
    />
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
  if (status === 'error') return <LoadError title="Opakování se nepodařilo načíst" className="recurring-feedback" onRetry={onRetry} />
  if (rules.length === 0) return <EmptyState variant="quiet" size="lg" className="recurring-empty"><EmptyStateIcon><CalendarClock aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Bez opakování</EmptyStateTitle><EmptyStateDescription>Přidej pravidlo pro pravidelnou transakci nebo převod.</EmptyStateDescription></EmptyState>

  return <div className="recurring-list-section">
    <h2 className="recurring-list-heading">Jednotlivá opakování</h2>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={rules.map((rule) => rule.id)} strategy={verticalListSortingStrategy}>
        <List gap="sm" className="recurring-list" aria-label="Seznam opakování">
          {rules.map((rule) => <SortableRecurringRuleRow key={rule.id} rule={rule} disabled={isReordering} onSelect={onSelect} />)}
        </List>
      </SortableContext>
    </DndContext>
  </div>
}
