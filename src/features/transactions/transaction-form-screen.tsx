import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MAX_NOTE_LENGTH } from '../../../server/src/catalog'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { DatePicker } from '../../components/ui/calendar'
import { AmountField } from '../../components/amount-field'
import { DeleteConfirmationDialog } from '../../components/delete-confirmation-dialog'
import { FormSubmissionError } from '../../components/form-submission-error'
import { LoadError } from '../../components/load-error'
import { ScreenHeader } from '../../components/screen-header'
import { Field, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Label as FormLabel } from '../../components/ui/label'
import { Skeleton } from '../../components/ui/skeleton'
import { amountErrorMessage, parsePositiveWholeCzk } from '../../lib/amount-input'
import { formatIsoDate, getPragueToday, parseIsoDate } from '../../lib/prague-date'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { CategoryPickerDialog } from '../categories/category-picker-dialog'
import { listCategories, type Category, type CategoryDirection } from '../categories/api'
import { InlineLabelPicker } from '../labels/inline-label-picker'
import { mergeLabels } from '../labels/label-chips'
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
    if (amountCzk === null) nextErrors.amountCzk = amountErrorMessage(values.amountCzk)
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
      action={transaction ? <DeleteConfirmationDialog title="Smazat transakci?" description="Tato transakce bude trvale smazána." triggerLabel="Smazat transakci" isDeleting={isDeleting} error={deleteError} onConfirm={() => void handleDelete()} /> : undefined}
    />
    {status === 'error' ? <LoadError title="Formulář se nepodařilo načíst" onRetry={() => setLoadAttempt((attempt) => attempt + 1)} /> : null}
    {status !== 'error' ? <form className="transaction-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {submissionError ? <FormSubmissionError subject="Transakci" action={transaction ? 'edit' : 'save'} message={submissionError} /> : null}
      <ToggleGroup type="single" value={values.direction} onValueChange={(next) => { if (next) changeDirection(next as CategoryDirection) }} width="full" className="transaction-direction" aria-label="Typ transakce">
        <ToggleGroupItem value="expense">Výdaj</ToggleGroupItem>
        <ToggleGroupItem value="income">Příjem</ToggleGroupItem>
      </ToggleGroup>
      <Card aria-label="Částka transakce" padding="none" className="transaction-amount-panel">
        <AmountField autoFocus value={values.amountCzk} error={errors.amountCzk} onChange={(amountCzk) => setValues((current) => ({ ...current, amountCzk }))} onErrorChange={(amountCzk) => setErrors((current) => ({ ...current, amountCzk }))} />
      </Card>
      <div className="transaction-primary-pickers">
        <Field invalid={Boolean(errors.categoryId)} className="transaction-primary-picker">
          <FieldLabel>Kategorie</FieldLabel>
          {status === 'loading' ? <Skeleton className="h-17 w-full" /> : <CategoryPickerDialog categories={selectableCategories} selectedCategory={selectedCategory} onSelect={(categoryId) => { setValues((current) => ({ ...current, categoryId })); setErrors((current) => ({ ...current, categoryId: undefined })) }} />}
          <FieldError match={Boolean(errors.categoryId)}>{errors.categoryId}</FieldError>
        </Field>
        <Field invalid={Boolean(errors.walletId)} className="transaction-primary-picker">
          <FieldLabel>Peněženka</FieldLabel>
          {status === 'loading' ? <Skeleton className="h-17 w-full" /> : <WalletPickerDialog wallets={wallets} selectedWallet={selectedWallet} placeholder="Vyber peněženku" onSelect={(walletId) => { setValues((current) => ({ ...current, walletId })); setErrors((current) => ({ ...current, walletId: undefined, transactionDate: undefined })) }} buttonClassName="transaction-primary-picker-button" />}
          <FieldError match={Boolean(errors.walletId)}>{errors.walletId}</FieldError>
        </Field>
      </div>
      {status === 'loading' ? <div className="transaction-labels"><FormLabel>Štítky</FormLabel><Skeleton className="h-9 w-32" /></div> : <InlineLabelPicker labels={labels} selectedIds={values.labelIds} onLabelsChange={setLabels} onValueChange={(labelIds) => setValues((current) => ({ ...current, labelIds }))} />}
      <section className="transaction-details" aria-label="Další podrobnosti">
        <Field invalid={Boolean(errors.transactionDate)}>
          <FieldLabel>Datum</FieldLabel>
          <DatePicker className="transaction-date-picker" value={parseIsoDate(values.transactionDate)} minDate={selectedWallet ? parseIsoDate(selectedWallet.openingBalanceDate) : undefined} onValueChange={(date) => { setValues((current) => ({ ...current, transactionDate: formatIsoDate(date) })); setErrors((current) => ({ ...current, transactionDate: undefined })) }} locale="cs-CZ" startOfWeek={1} />
          <FieldError match={Boolean(errors.transactionDate)}>{errors.transactionDate}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Poznámka</FieldLabel>
          <Input value={values.note} placeholder="Volitelné" maxLength={MAX_NOTE_LENGTH} onChange={(event) => { const note = event.currentTarget.value; setValues((current) => ({ ...current, note })) }} />
        </Field>
      </section>
      <Button type="submit" size="lg" className="transaction-form-submit" loading={isSubmitting} disabled={status === 'loading' || wallets.length === 0 || selectableCategories.length === 0}>{transaction ? 'Uložit změny' : 'Uložit transakci'}</Button>
      {wallets.length === 0 || selectableCategories.length === 0 ? <p className="transaction-form-hint">Pro uložení potřebuješ alespoň jednu peněženku a kategorii pro tento typ transakce.</p> : null}
      {transaction && deleteError ? <FormSubmissionError subject="Transakci" action="delete" message={deleteError} /> : null}
    </form> : null}
  </section>
}

function initialValues(transaction?: Transaction): TransactionFormValues { return { direction: transaction?.direction ?? 'expense', walletId: transaction?.walletId ?? '', categoryId: transaction?.categoryId ?? '', amountCzk: transaction ? String(transaction.amountCzk) : '', transactionDate: transaction?.transactionDate ?? getPragueToday(), note: transaction?.note ?? '', labelIds: transaction?.labels.map((label) => label.id) ?? [] } }
