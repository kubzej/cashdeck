import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRightLeft, CalendarClock, CircleAlert, Plus, ReceiptText, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemDescription, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { RecurringRuleFormScreen } from './recurring-rule-form-screen'
import { listRecurringRules, type RecurringRule } from './api'
import './recurring.css'

type RecurringView = 'list' | 'new' | 'edit'

export function RecurringRulesScreen({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<RecurringView>('list')
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedRule, setSelectedRule] = useState<RecurringRule | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

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

  if (view === 'new') return <RecurringRuleFormScreen onCancel={() => setView('list')} onSaved={finishForm} />
  if (view === 'edit' && selectedRule) return <RecurringRuleFormScreen rule={selectedRule} onCancel={() => setView('list')} onSaved={finishForm} onDeleted={finishForm} />

  return <section className="recurring-screen" aria-labelledby="recurring-title">
    <header className="recurring-header">
      <Button variant="ghost" size="icon" aria-label="Zpět do nastavení" onClick={onBack}><ArrowLeft aria-hidden="true" /></Button>
      <h1 id="recurring-title">Opakování</h1>
      <Button variant="ghost" size="icon" aria-label="Přidat opakování" onClick={() => setView('new')}><Plus aria-hidden="true" /></Button>
    </header>
    <RecurringRulePanel
      rules={rules}
      status={status}
      onRetry={() => setReloadKey((current) => current + 1)}
      onSelect={(rule) => { setSelectedRule(rule); setView('edit') }}
    />
  </section>
}

function RecurringRulePanel({ rules, status, onRetry, onSelect }: { rules: RecurringRule[]; status: 'loading' | 'ready' | 'error'; onRetry: () => void; onSelect: (rule: RecurringRule) => void }) {
  if (status === 'loading') return <div className="recurring-loading" aria-label="Načítání opakování"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
  if (status === 'error') return <FeedbackState status="error" layout="panel" className="recurring-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Opakování se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
  if (rules.length === 0) return <EmptyState variant="quiet" size="lg" className="recurring-empty"><EmptyStateIcon><CalendarClock aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Bez opakování</EmptyStateTitle><EmptyStateDescription>Přidej pravidlo pro pravidelnou transakci nebo převod.</EmptyStateDescription></EmptyState>

  return <List gap="sm" className="recurring-list" aria-label="Seznam opakování">
    {rules.map((rule) => <RecurringRuleRow key={rule.id} rule={rule} onSelect={onSelect} />)}
  </List>
}

function RecurringRuleRow({ rule, onSelect }: { rule: RecurringRule; onSelect: (rule: RecurringRule) => void }) {
  const isTransfer = rule.kind === 'transfer'
  const direction = rule.categoryDirection ?? 'expense'
  const amountPrefix = isTransfer ? '' : direction === 'income' ? '+' : '-'

  return <ListItem render={<button type="button" onClick={() => onSelect(rule)} />} interactive variant="quiet" size="default" className="surface-row recurring-row">
    <div className={`recurring-row__icon${isTransfer ? ' recurring-row__icon--transfer' : ''}`} aria-hidden="true">{isTransfer ? <ArrowRightLeft /> : <ReceiptText />}</div>
    <ListItemContent>
      <ListItemTitle>{rule.name}</ListItemTitle>
      <ListItemDescription>{rule.status === 'ended' ? 'Ukončeno' : `${formatFrequency(rule)}, další ${formatDate(rule.nextOccurrenceDate)}`}</ListItemDescription>
      {rule.endsOn ? <ListItemDescription className="recurring-row__end">{rule.status === 'ended' ? `Ukončeno ${formatDate(rule.endsOn)}` : `Končí ${formatDate(rule.endsOn)}`}</ListItemDescription> : null}
      {rule.labels.length > 0 ? <div className="recurring-row__labels" aria-label="Štítky">{rule.labels.map((label) => <span key={label.id} className="recurring-row__label">{label.name}</span>)}</div> : null}
      {rule.note ? <ListItemDescription className="recurring-row__note">{rule.note}</ListItemDescription> : null}
    </ListItemContent>
    <ListItemActions className={`recurring-row__amount recurring-row__amount--${isTransfer ? 'transfer' : direction}`}>{amountPrefix}{formatCzk(rule.amountCzk)} Kč</ListItemActions>
  </ListItem>
}

export function formatFrequency(rule: Pick<RecurringRule, 'frequency' | 'customIntervalDays'>) {
  const labels: Record<Exclude<RecurringRule['frequency'], 'custom_days'>, string> = {
    daily: 'Denně', weekly: 'Každý týden', biweekly: 'Každé 2 týdny', monthly: 'Každý měsíc',
    every_two_months: 'Každé 2 měsíce', every_three_months: 'Každé 3 měsíce',
    semiannual: 'Jednou za půl roku', yearly: 'Ročně',
  }
  return rule.frequency === 'custom_days' ? `Každých ${rule.customIntervalDays} dní` : labels[rule.frequency]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseIsoDate(value))
}

function formatCzk(value: number) {
  return new Intl.NumberFormat('cs-CZ').format(value)
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
