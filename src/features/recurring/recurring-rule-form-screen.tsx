import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRightLeft, Check, CircleAlert, ReceiptText, Tag } from 'lucide-react'
import { DeleteConfirmationDialog } from '../../components/delete-confirmation-dialog'
import { FormLoadError } from '../../components/form-load-error'
import { ScreenHeader } from '../../components/screen-header'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { DatePicker } from '../../components/ui/calendar'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Field, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { createDecimalKeyBlocker, DECIMAL_INPUT_ERROR, sanitizeAmountInput } from '../../lib/amount-input'
import { formatIsoDate, getPragueToday, parseIsoDate } from '../../lib/prague-date'
import { CategoryIcon } from '../categories/category-icon'
import { listCategories, type Category, type CategoryDirection } from '../categories/api'
import { InlineLabelPicker } from '../labels/inline-label-picker'
import { listLabels, type Label } from '../labels/api'
import { listWallets, type Wallet } from '../wallets/api'
import { WalletPickerDialog } from '../wallets/wallet-picker-dialog'
import { createRecurringRule, deleteRecurringRule, recurringFrequencies, updateRecurringRule, type RecurringFrequency, type RecurringRule, type RecurringRuleKind } from './api'
import { initialRecurringRuleFormValues, toRecurringRuleInput, validateRecurringRuleForm, type RecurringRuleFormErrors, type RecurringRuleFormValues } from './form-model'
import '../transactions/transactions.css'
import './recurring.css'

const frequencyLabels: Record<RecurringFrequency, string> = {
  daily: 'Denně', weekly: 'Každý týden', biweekly: 'Každé 2 týdny', monthly: 'Každý měsíc',
  every_two_months: 'Každé 2 měsíce', every_three_months: 'Každé 3 měsíce',
  semiannual: 'Jednou za půl roku', yearly: 'Ročně', custom_days: 'Vlastní interval',
}

export function RecurringRuleFormScreen({ rule, onCancel, onSaved, onDeleted }: { rule?: RecurringRule; onCancel: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const today = getPragueToday()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [values, setValues] = useState<RecurringRuleFormValues>(() => initialRecurringRuleFormValues(rule, today))
  const [errors, setErrors] = useState<RecurringRuleFormErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const selectableCategories = useMemo(() => categories.filter((category) => category.direction === values.direction), [categories, values.direction])
  const selectedCategory = categories.find((category) => category.id === values.categoryId) ?? null
  const selectedWallet = wallets.find((wallet) => wallet.id === values.walletId) ?? null
  const sourceWallet = wallets.find((wallet) => wallet.id === values.sourceWalletId) ?? null
  const destinationWallet = wallets.find((wallet) => wallet.id === values.destinationWalletId) ?? null

  useEffect(() => {
    let cancelled = false
    async function loadFormData() {
      setStatus('loading')
      try {
        const [walletResult, categoryResult, labelResult] = await Promise.all([listWallets(), listCategories(), listLabels({ limit: 8, sort: 'recent' })])
        if (cancelled) return
        setWallets(walletResult.items)
        setCategories(categoryResult.items)
        setLabels(mergeLabels(rule?.labels ?? [], labelResult.items))
        setValues((current) => {
          const sourceWalletId = current.sourceWalletId || walletResult.items[0]?.id || ''
          return {
            ...current,
            walletId: current.walletId || walletResult.items[0]?.id || '',
            sourceWalletId,
            destinationWalletId: current.destinationWalletId || walletResult.items.find((wallet) => wallet.id !== sourceWalletId)?.id || '',
          }
        })
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void loadFormData()
    return () => { cancelled = true }
  }, [loadAttempt, rule])

  function setKind(kind: RecurringRuleKind) {
    setValues((current) => ({ ...current, kind, categoryId: kind === 'transfer' ? '' : current.categoryId }))
  }

  function setDirection(direction: CategoryDirection) {
    setValues((current) => ({ ...current, direction, categoryId: '' }))
  }

  function setNextOccurrenceDate(nextOccurrenceDate: string) {
    setValues((current) => ({ ...current, nextOccurrenceDate }))
    setErrors((current) => ({
      ...current,
      nextOccurrenceDate: nextOccurrenceDate < today ? 'Další výskyt musí být dnes nebo v budoucnu.' : undefined,
      endsOn: values.endsOn && values.endsOn < nextOccurrenceDate ? 'Konec nesmí být před dalším výskytem.' : undefined,
    }))
  }

  function setEndsOn(endsOn: string) {
    setValues((current) => ({ ...current, endsOn }))
    setErrors((current) => ({
      ...current,
      endsOn: endsOn && endsOn < values.nextOccurrenceDate ? 'Konec nesmí být před dalším výskytem.' : undefined,
    }))
  }

  function setEndMode(mode: string) {
    const endsOn = mode === 'date' ? values.nextOccurrenceDate : ''
    setValues((current) => ({ ...current, endsOn }))
    setErrors((current) => ({ ...current, endsOn: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = toRecurringRuleInput(values)
    const nextErrors = validateRecurringRuleForm(values, input, today, rule)
    setErrors(nextErrors)
    setSubmissionError(null)
    if (!input || Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    try {
      if (rule) await updateRecurringRule(rule.id, input)
      else await createRecurringRule(input)
      onSaved()
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Opakování se nepodařilo uložit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!rule || !onDeleted) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteRecurringRule(rule.id)
      onDeleted()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Opakování se nepodařilo smazat.')
    } finally {
      setIsDeleting(false)
    }
  }

  return <section className="transaction-form-screen" aria-labelledby="recurring-form-title">
    <ScreenHeader
      title={rule ? 'Upravit opakování' : 'Nové opakování'}
      titleId="recurring-form-title"
      backLabel="Zpět na opakování"
      onBack={onCancel}
      action={rule ? <DeleteConfirmationDialog title="Smazat opakování?" description="Pravidlo bude smazáno, dříve vytvořené transakce a převody zůstanou." triggerLabel="Smazat opakování" isDeleting={isDeleting} onConfirm={() => void handleDelete()} /> : undefined}
    />
    {status === 'error' ? <FormLoadError onRetry={() => setLoadAttempt((attempt) => attempt + 1)} /> : null}
    {status !== 'error' ? <form className="transaction-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      {submissionError ? <SubmissionError message={submissionError} /> : null}
      <Field invalid={Boolean(errors.name)}>
        <FieldLabel>Název</FieldLabel>
        <Input autoFocus value={values.name} maxLength={120} placeholder="Např. Nájem" onChange={(event) => { const name = event.currentTarget.value; setValues((current) => ({ ...current, name })) }} />
        <FieldError match={Boolean(errors.name)}>{errors.name}</FieldError>
      </Field>
      <Card aria-label="Částka a typ opakování" padding="none" className="transaction-amount-panel">
        <ToggleGroup type="single" width="full" value={values.kind} disabled={Boolean(rule)} onValueChange={(value) => { if (value) setKind(value as RecurringRuleKind) }} className="transaction-direction" aria-label="Typ opakování">
          <ToggleGroupItem value="transaction"><ReceiptText aria-hidden="true" />Transakce</ToggleGroupItem>
          <ToggleGroupItem value="transfer"><ArrowRightLeft aria-hidden="true" />Převod</ToggleGroupItem>
        </ToggleGroup>
        {rule ? <p className="transaction-form-hint">Typ opakování nelze po vytvoření změnit — smaž pravidlo a založ nové.</p> : null}
        {values.kind === 'transaction' ? <ToggleGroup type="single" width="full" value={values.direction} onValueChange={(value) => { if (value) setDirection(value as CategoryDirection) }} className="transaction-direction" aria-label="Směr transakce">
          <ToggleGroupItem value="expense">Výdaj</ToggleGroupItem>
          <ToggleGroupItem value="income">Příjem</ToggleGroupItem>
        </ToggleGroup> : null}
        <Field invalid={Boolean(errors.amountCzk)} className="transaction-amount-field">
          <FieldLabel>Částka</FieldLabel>
          <div className="transaction-amount"><Input type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" value={values.amountCzk} placeholder="0" aria-label="Částka v korunách" onKeyDown={createDecimalKeyBlocker(() => setErrors((current) => ({ ...current, amountCzk: DECIMAL_INPUT_ERROR })))} onChange={(event) => { const { value: amountCzk, error } = sanitizeAmountInput(event.currentTarget.value); setErrors((current) => ({ ...current, amountCzk: error })); setValues((current) => ({ ...current, amountCzk })) }} /><span>Kč</span></div>
          <FieldError match={Boolean(errors.amountCzk)}>{errors.amountCzk}</FieldError>
        </Field>
      </Card>
      {values.kind === 'transaction' ? <div className="transaction-primary-pickers">
        <Field invalid={Boolean(errors.categoryId)} className="transaction-primary-picker"><FieldLabel>Kategorie</FieldLabel>{status === 'loading' ? <Skeleton className="h-36 w-full" /> : <RecurringCategoryPicker categories={selectableCategories} selectedCategory={selectedCategory} onSelect={(categoryId) => setValues((current) => ({ ...current, categoryId }))} />}<FieldError match={Boolean(errors.categoryId)}>{errors.categoryId}</FieldError></Field>
        <Field invalid={Boolean(errors.walletId)} className="transaction-primary-picker"><FieldLabel>Peněženka</FieldLabel>{status === 'loading' ? <Skeleton className="h-36 w-full" /> : <WalletPickerDialog wallets={wallets} selectedWallet={selectedWallet} placeholder="Vyber peněženku" onSelect={(walletId) => setValues((current) => ({ ...current, walletId }))} buttonClassName="transaction-primary-picker-button" />}<FieldError match={Boolean(errors.walletId)}>{errors.walletId}</FieldError></Field>
      </div> : <div className="transaction-primary-pickers transfer-wallet-pickers">
        <Field invalid={Boolean(errors.sourceWalletId)} className="transaction-primary-picker"><FieldLabel>Z peněženky</FieldLabel>{status === 'loading' ? <Skeleton className="h-36 w-full" /> : <WalletPickerDialog wallets={wallets} selectedWallet={sourceWallet} placeholder="Vyber zdroj" onSelect={(sourceWalletId) => setValues((current) => ({ ...current, sourceWalletId }))} buttonClassName="transaction-primary-picker-button" />}<FieldError match={Boolean(errors.sourceWalletId)}>{errors.sourceWalletId}</FieldError></Field>
        <Field invalid={Boolean(errors.destinationWalletId)} className="transaction-primary-picker"><FieldLabel>Do peněženky</FieldLabel>{status === 'loading' ? <Skeleton className="h-36 w-full" /> : <WalletPickerDialog wallets={wallets} selectedWallet={destinationWallet} placeholder="Vyber cíl" onSelect={(destinationWalletId) => setValues((current) => ({ ...current, destinationWalletId }))} buttonClassName="transaction-primary-picker-button" />}<FieldError match={Boolean(errors.destinationWalletId)}>{errors.destinationWalletId}</FieldError></Field>
      </div>}
      {status === 'loading' ? <Skeleton className="h-9 w-32" /> : <InlineLabelPicker labels={labels} selectedIds={values.labelIds} onLabelsChange={setLabels} onValueChange={(labelIds) => setValues((current) => ({ ...current, labelIds }))} />}
      <section className="transaction-details" aria-label="Plán opakování">
        <Field invalid={Boolean(errors.nextOccurrenceDate)}><FieldLabel>Další výskyt</FieldLabel><DatePicker className="transaction-date-picker" value={parseIsoDate(values.nextOccurrenceDate)} minDate={parseIsoDate(today)} onValueChange={(date) => setNextOccurrenceDate(formatIsoDate(date))} locale="cs-CZ" startOfWeek={1} /><FieldError match={Boolean(errors.nextOccurrenceDate)}>{errors.nextOccurrenceDate}</FieldError></Field>
        <Field invalid={Boolean(errors.customIntervalDays)}><FieldLabel>Opakování</FieldLabel><Select items={frequencyLabels} value={values.frequency} onValueChange={(value) => setValues((current) => ({ ...current, frequency: value as RecurringFrequency }))}><SelectTrigger aria-label="Frekvence opakování"><SelectValue /></SelectTrigger><SelectContent>{recurringFrequencies.map((frequency) => <SelectItem key={frequency} value={frequency}>{frequencyLabels[frequency]}</SelectItem>)}</SelectContent></Select>{values.frequency === 'custom_days' ? <Input className="recurring-custom-interval" type="text" inputMode="numeric" pattern="[0-9]*" value={values.customIntervalDays} placeholder="Počet dní" aria-label="Počet dní vlastního intervalu" onChange={(event) => { const customIntervalDays = event.currentTarget.value.replaceAll(/[^0-9]/g, ''); setValues((current) => ({ ...current, customIntervalDays })) }} /> : null}<FieldError match={Boolean(errors.customIntervalDays)}>{errors.customIntervalDays}</FieldError></Field>
        <Field invalid={Boolean(errors.endsOn)}><FieldLabel>Končí</FieldLabel><ToggleGroup type="single" width="full" value={values.endsOn ? 'date' : 'never'} onValueChange={(value) => { if (value) setEndMode(value) }} className="transaction-direction" aria-label="Konec opakování"><ToggleGroupItem value="never">Nikdy</ToggleGroupItem><ToggleGroupItem value="date">K datu</ToggleGroupItem></ToggleGroup>{values.endsOn ? <DatePicker className="transaction-date-picker" value={parseIsoDate(values.endsOn)} minDate={parseIsoDate(values.nextOccurrenceDate)} onValueChange={(date) => setEndsOn(formatIsoDate(date))} locale="cs-CZ" startOfWeek={1} /> : null}<FieldError match={Boolean(errors.endsOn)}>{errors.endsOn}</FieldError></Field>
        <Field><FieldLabel>Poznámka</FieldLabel><Input value={values.note} maxLength={2000} placeholder="Volitelné" onChange={(event) => { const note = event.currentTarget.value; setValues((current) => ({ ...current, note })) }} /></Field>
      </section>
      <Button type="submit" size="lg" className="transaction-form-submit" loading={isSubmitting} disabled={status === 'loading'}>{rule ? 'Uložit změny' : 'Uložit opakování'}</Button>
      {deleteError ? <SubmissionError message={deleteError} title="Opakování se nepodařilo smazat" /> : null}
    </form> : null}
  </section>
}

function RecurringCategoryPicker({ categories, selectedCategory, onSelect }: { categories: Category[]; selectedCategory: Category | null; onSelect: (categoryId: string) => void }) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" className="transaction-picker-button" data-selected={selectedCategory ? '' : undefined} />}>{selectedCategory ? <><CategoryIcon iconKey={selectedCategory.iconKey} colorKey={selectedCategory.colorKey} /><span>{selectedCategory.name}</span></> : <><Tag aria-hidden="true" /><span>Vyber kategorii</span></>}</DialogTrigger>
    <DialogContent size="default" className="transaction-picker-dialog" showCloseButton={false}><DialogHeader><DialogTitle>Vyber kategorii</DialogTitle></DialogHeader><DialogBody><div className="transaction-category-grid">{categories.map((category) => <button key={category.id} className={`transaction-category-option color-key--${category.colorKey}`} data-selected={selectedCategory?.id === category.id || undefined} type="button" onClick={() => { onSelect(category.id); setOpen(false) }}><CategoryIcon iconKey={category.iconKey} colorKey={category.colorKey} /><span>{category.name}</span>{selectedCategory?.id === category.id ? <Check aria-hidden="true" /> : null}</button>)}</div></DialogBody></DialogContent>
  </Dialog>
}

function SubmissionError({ message, title = 'Opakování se nepodařilo uložit' }: { message: string; title?: string }) { return <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>{title}</FeedbackStateTitle><FeedbackStateDescription>{message}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> }
function mergeLabels(selected: RecurringRule['labels'], recent: Label[]) { return [...selected, ...recent.filter((recentLabel) => !selected.some((selectedLabel) => selectedLabel.id === recentLabel.id))].slice(0, 8) }
