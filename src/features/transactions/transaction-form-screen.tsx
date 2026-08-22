import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, CircleAlert, Tag } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { DatePicker } from '../../components/ui/calendar'
import { DeleteConfirmationDialog } from '../../components/delete-confirmation-dialog'
import { FormLoadError } from '../../components/form-load-error'
import { ScreenHeader } from '../../components/screen-header'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Field, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Label as FormLabel } from '../../components/ui/label'
import { Skeleton } from '../../components/ui/skeleton'
import { createDecimalKeyBlocker, DECIMAL_INPUT_ERROR, parsePositiveWholeCzk, sanitizeAmountInput } from '../../lib/amount-input'
import { formatIsoDate, getPragueToday, parseIsoDate } from '../../lib/prague-date'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { CategoryIcon } from '../categories/category-icon'
import { listCategories, type Category, type CategoryDirection } from '../categories/api'
import { InlineLabelPicker } from '../labels/inline-label-picker'
import { listLabels, type Label } from '../labels/api'
import { listWallets, type Wallet } from '../wallets/api'
import { WalletPickerDialog } from '../wallets/wallet-picker-dialog'
import { createTransaction, deleteTransaction, updateTransaction, type Transaction } from './api'
import './transactions.css'

type TransactionFormValues = {
  direction: CategoryDirection
  walletId: string
  categoryId: string
  amountCzk: string
  transactionDate: string
  note: string
  labelIds: string[]
}

type ValidationErrors = Partial<Record<'walletId' | 'categoryId' | 'amountCzk' | 'transactionDate', string>>

export function TransactionFormScreen({ transaction, onCancel, onSaved, onDeleted }: { transaction?: Transaction; onCancel: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [values, setValues] = useState<TransactionFormValues>(() => initialValues(transaction))
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const selectableCategories = useMemo(() => categories.filter((category) => category.direction === values.direction), [categories, values.direction])
  const selectedCategory = categories.find((category) => category.id === values.categoryId) ?? null
  const selectedWallet = wallets.find((wallet) => wallet.id === values.walletId) ?? null

  useEffect(() => {
    let cancelled = false

    async function loadFormData() {
      setStatus('loading')
      try {
        const [walletResult, categoryResult, labelResult] = await Promise.all([listWallets(), listCategories(), listLabels({ limit: 8, sort: 'recent' })])
        if (cancelled) return
        setWallets(walletResult.items)
        setCategories(categoryResult.items)
        setLabels(mergeLabels(transaction?.labels ?? [], labelResult.items))
        setValues((current) => ({
          ...current,
          walletId: current.walletId || walletResult.items[0]?.id || '',
          categoryId: current.categoryId,
        }))
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void loadFormData()
    return () => { cancelled = true }
  }, [loadAttempt, transaction])

  function changeDirection(direction: CategoryDirection) {
    setValues((current) => ({ ...current, direction, categoryId: '' }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: ValidationErrors = {}
    const amountCzk = parsePositiveWholeCzk(values.amountCzk)
    if (!values.walletId) nextErrors.walletId = 'Vyber peněženku.'
    if (!values.categoryId) nextErrors.categoryId = 'Vyber kategorii.'
    if (amountCzk === null) nextErrors.amountCzk = 'Zadej celý počet korun větší než nula.'
    if (!values.transactionDate) nextErrors.transactionDate = 'Vyber datum.'
    else if (selectedWallet && values.transactionDate < selectedWallet.openingBalanceDate) nextErrors.transactionDate = 'Datum nemůže být před založením peněženky.'
    setErrors(nextErrors)
    setSubmissionError(null)
    if (Object.keys(nextErrors).length > 0 || amountCzk === null) return

    setIsSubmitting(true)
    try {
      const input = { walletId: values.walletId, categoryId: values.categoryId, amountCzk, transactionDate: values.transactionDate, note: values.note.trim() || null, labelIds: values.labelIds }
      if (transaction) await updateTransaction(transaction.id, input)
      else await createTransaction(input)
      onSaved()
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Transakci se nepodařilo uložit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!transaction || !onDeleted) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteTransaction(transaction.id)
      onDeleted()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Transakci se nepodařilo smazat.')
    } finally {
      setIsDeleting(false)
    }
  }

  return <section className="transaction-form-screen" aria-labelledby="transaction-form-title">
    <ScreenHeader
      title={transaction ? 'Upravit transakci' : 'Nová transakce'}
      titleId="transaction-form-title"
      backLabel="Zpět na transakce"
      onBack={onCancel}
      action={transaction ? <DeleteConfirmationDialog title="Smazat transakci?" description="Tato transakce bude trvale smazána." triggerLabel="Smazat transakci" isDeleting={isDeleting} onConfirm={() => void handleDelete()} /> : undefined}
    />
    {status === 'error' ? <FormLoadError onRetry={() => setLoadAttempt((attempt) => attempt + 1)} /> : null}
    {status !== 'error' ? <form className="transaction-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {submissionError ? <SubmissionError isEdit={Boolean(transaction)} message={submissionError} /> : null}
      <section className="transaction-amount-panel" aria-label="Částka a typ transakce">
        <ToggleGroup type="single" value={values.direction} onValueChange={(next) => { if (next) changeDirection(next as CategoryDirection) }} className="transaction-direction" aria-label="Typ transakce">
          <ToggleGroupItem value="expense">Výdaj</ToggleGroupItem>
          <ToggleGroupItem value="income">Příjem</ToggleGroupItem>
        </ToggleGroup>
        <Field invalid={Boolean(errors.amountCzk)} className="transaction-amount-field">
          <FieldLabel>Částka</FieldLabel>
          <div className="transaction-amount">
            <Input autoFocus type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" value={values.amountCzk} placeholder="0" aria-label="Částka v korunách" onKeyDown={createDecimalKeyBlocker(() => setErrors((current) => ({ ...current, amountCzk: DECIMAL_INPUT_ERROR })))} onChange={(event) => { const { value: amountCzk, error } = sanitizeAmountInput(event.currentTarget.value); setErrors((current) => ({ ...current, amountCzk: error })); setValues((current) => ({ ...current, amountCzk })) }} />
            <span>Kč</span>
          </div>
          <FieldError match={Boolean(errors.amountCzk)}>{errors.amountCzk}</FieldError>
        </Field>
      </section>
      <div className="transaction-primary-pickers">
        <Field invalid={Boolean(errors.categoryId)} className="transaction-primary-picker">
          <FieldLabel>Kategorie</FieldLabel>
          {status === 'loading' ? <Skeleton className="h-[4.25rem] w-full" /> : <CategoryPicker categories={selectableCategories} selectedCategory={selectedCategory} onSelect={(categoryId) => setValues((current) => ({ ...current, categoryId }))} />}
          <FieldError match={Boolean(errors.categoryId)}>{errors.categoryId}</FieldError>
        </Field>
        <Field invalid={Boolean(errors.walletId)} className="transaction-primary-picker">
          <FieldLabel>Peněženka</FieldLabel>
          {status === 'loading' ? <Skeleton className="h-[4.25rem] w-full" /> : <WalletPickerDialog wallets={wallets} selectedWallet={selectedWallet} placeholder="Vyber peněženku" onSelect={(walletId) => setValues((current) => ({ ...current, walletId }))} buttonClassName="transaction-primary-picker-button" />}
          <FieldError match={Boolean(errors.walletId)}>{errors.walletId}</FieldError>
        </Field>
      </div>
      {status === 'loading' ? <div className="transaction-labels"><FormLabel>Štítky</FormLabel><Skeleton className="h-9 w-32" /></div> : <InlineLabelPicker labels={labels} selectedIds={values.labelIds} onLabelsChange={setLabels} onValueChange={(labelIds) => setValues((current) => ({ ...current, labelIds }))} />}
      <section className="transaction-details" aria-label="Další podrobnosti">
        <Field invalid={Boolean(errors.transactionDate)}>
          <FieldLabel>Datum</FieldLabel>
          <DatePicker className="transaction-date-picker" value={parseIsoDate(values.transactionDate)} minDate={selectedWallet ? parseIsoDate(selectedWallet.openingBalanceDate) : undefined} onValueChange={(date) => setValues((current) => ({ ...current, transactionDate: formatIsoDate(date) }))} locale="cs-CZ" startOfWeek={1} />
          <FieldError match={Boolean(errors.transactionDate)}>{errors.transactionDate}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Poznámka</FieldLabel>
          <Input value={values.note} placeholder="Volitelné" maxLength={2000} onChange={(event) => { const note = event.currentTarget.value; setValues((current) => ({ ...current, note })) }} />
        </Field>
      </section>
      <Button type="submit" size="lg" className="transaction-form-submit" loading={isSubmitting} disabled={status === 'loading' || wallets.length === 0 || selectableCategories.length === 0}>{transaction ? 'Uložit změny' : 'Uložit transakci'}</Button>
      {wallets.length === 0 || selectableCategories.length === 0 ? <p className="transaction-form-hint">Pro uložení potřebuješ alespoň jednu peněženku a kategorii pro tento typ transakce.</p> : null}
      {transaction && deleteError ? <SubmissionError isDelete message={deleteError} /> : null}
    </form> : null}
  </section>
}

function CategoryPicker({ categories, selectedCategory, onSelect }: { categories: Category[]; selectedCategory: Category | null; onSelect: (categoryId: string) => void }) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" className="transaction-picker-button" data-selected={selectedCategory ? '' : undefined} />}>
      {selectedCategory ? <><CategoryIcon iconKey={selectedCategory.iconKey} colorKey={selectedCategory.colorKey} /><span>{selectedCategory.name}</span></> : <><Tag aria-hidden="true" /><span>Vyber kategorii</span></>}
    </DialogTrigger>
    <DialogContent size="default" className="transaction-picker-dialog" showCloseButton={false}>
      <DialogHeader><DialogTitle>Vyber kategorii</DialogTitle></DialogHeader>
      <DialogBody><div className="transaction-category-grid">
        {categories.map((category) => <button key={category.id} className={`transaction-category-option color-key--${category.colorKey}`} data-selected={selectedCategory?.id === category.id || undefined} type="button" onClick={() => { onSelect(category.id); setOpen(false) }}><CategoryIcon iconKey={category.iconKey} colorKey={category.colorKey} /><span>{category.name}</span>{selectedCategory?.id === category.id ? <Check aria-hidden="true" /> : null}</button>)}
      </div></DialogBody>
    </DialogContent>
  </Dialog>
}

function SubmissionError({ message, isEdit = false, isDelete = false }: { message: string; isEdit?: boolean; isDelete?: boolean }) { return <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>{isDelete ? 'Transakci se nepodařilo smazat' : `Transakci se nepodařilo ${isEdit ? 'upravit' : 'uložit'}`}</FeedbackStateTitle><FeedbackStateDescription>{message}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> }
function initialValues(transaction?: Transaction): TransactionFormValues { return { direction: transaction?.direction ?? 'expense', walletId: transaction?.walletId ?? '', categoryId: transaction?.categoryId ?? '', amountCzk: transaction ? String(transaction.amountCzk) : '', transactionDate: transaction?.transactionDate ?? getPragueToday(), note: transaction?.note ?? '', labelIds: transaction?.labels.map((label) => label.id) ?? [] } }
function mergeLabels(selected: Transaction['labels'], recent: Label[]) { return [...selected, ...recent.filter((recentLabel) => !selected.some((selectedLabel) => selectedLabel.id === recentLabel.id))].slice(0, 8) }
