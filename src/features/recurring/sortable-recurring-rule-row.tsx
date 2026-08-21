import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { ArrowRightLeft, GripVertical, ReceiptText } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ListItem, ListItemActions, ListItemContent, ListItemDescription, ListItemTitle } from '../../components/ui/list'
import { CategoryIcon } from '../categories/category-icon'
import { formatCzk } from '../../lib/format-czk'
import { parseIsoDate } from '../../lib/prague-date'
import { type RecurringRule } from './api'

export function SortableRecurringRuleRow({ rule, disabled, onSelect }: { rule: RecurringRule; disabled: boolean; onSelect: (rule: RecurringRule) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id, disabled })
  const isTransfer = rule.kind === 'transfer'
  const direction = rule.categoryDirection ?? 'expense'
  const amountPrefix = isTransfer ? '' : direction === 'income' ? '+' : '-'
  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.45 : undefined,
  }

  return <ListItem render={<div ref={setNodeRef} style={style} />} role="listitem" interactive variant="quiet" size="default" className="surface-row recurring-row" onClick={() => onSelect(rule)}>
    <div className={`recurring-row__icon${isTransfer ? ' recurring-row__icon--transfer' : rule.categoryColorKey ? ` color-key--${rule.categoryColorKey}` : ''}`} aria-hidden="true">
      {isTransfer ? <ArrowRightLeft /> : rule.categoryIconKey && rule.categoryColorKey ? <CategoryIcon iconKey={rule.categoryIconKey} colorKey={rule.categoryColorKey} /> : <ReceiptText />}
    </div>
    <ListItemContent>
      <ListItemTitle>{rule.name}</ListItemTitle>
      <ListItemDescription className="recurring-row__wallet">{isTransfer ? `z ${rule.sourceWalletName} do ${rule.destinationWalletName}` : `v ${rule.walletName}`}</ListItemDescription>
      <ListItemDescription>{rule.status === 'ended' ? 'Ukončeno' : `${formatFrequency(rule)}, ${formatDate(rule.nextOccurrenceDate)}`}</ListItemDescription>
      {rule.endsOn ? <ListItemDescription className="recurring-row__end">{rule.status === 'ended' ? `Ukončeno ${formatDate(rule.endsOn)}` : `Končí ${formatDate(rule.endsOn)}`}</ListItemDescription> : null}
      {rule.labels.length > 0 ? <div className="recurring-row__labels" aria-label="Štítky">{rule.labels.map((label) => <span key={label.id} className="recurring-row__label">{label.name}</span>)}</div> : null}
      {rule.note ? <ListItemDescription className="recurring-row__note">{rule.note}</ListItemDescription> : null}
    </ListItemContent>
    <ListItemActions>
      <strong className={`recurring-row__amount recurring-row__amount--${isTransfer ? 'transfer' : direction}`}>{amountPrefix}{formatCzk(rule.amountCzk)}</strong>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Změnit pořadí opakování ${rule.name}`}
        disabled={disabled}
        ref={setActivatorNodeRef}
        className="recurring-row__drag-handle"
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </Button>
    </ListItemActions>
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
