import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRightLeft } from 'lucide-react'
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
import { amountErrorMessage, parseAmountCzk } from '../../lib/amount-input'
import { formatIsoDate, getPragueToday, parseIsoDate } from '../../lib/prague-date'
import { InlineLabelPicker } from '../labels/inline-label-picker'
import { mergeLabels } from '../labels/label-chips'
import { listLabels, type Label } from '../labels/api'
import { listWallets, type Wallet } from '../wallets/api'
import { WalletPickerDialog } from '../wallets/wallet-picker-dialog'
import { createTransfer, deleteTransfer, updateTransfer, type Transfer } from './api'
import '../transactions/transactions.css'

type TransferFormValues = {
  sourceWalletId: string
  destinationWalletId: string
  amountCzk: string
  transferDate: string
  note: string
  labelIds: string[]
}

type ValidationErrors = Partial<Record<'sourceWalletId' | 'destinationWalletId' | 'amountCzk' | 'transferDate', string>>

export function TransferFormScreen({ transfer, onCancel, onSaved, onDeleted }: { transfer?: Transfer; onCancel: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [values, setValues] = useState<TransferFormValues>(() => initialValues(transfer))
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const sourceWallet = wallets.find((wallet) => wallet.id === values.sourceWalletId) ?? null
  const destinationWallet = wallets.find((wallet) => wallet.id === values.destinationWalletId) ?? null
  const transferMinDate = [sourceWallet?.openingBalanceDate, destinationWallet?.openingBalanceDate].filter((date): date is string => Boolean(date)).sort().at(-1)

  useEffect(() => {
    let cancelled = false

    async function loadFormData() {
      setStatus('loading')
      try {
        const [walletResult, labelResult] = await Promise.all([listWallets(), listLabels({ limit: 8, sort: 'recent' })])
        if (cancelled) return
        setWallets(walletResult.items)
        setLabels(mergeLabels(transfer?.labels ?? [], labelResult.items))
        setValues((current) => {
          const sourceWalletId = current.sourceWalletId || walletResult.items[0]?.id || ''
          return {
            ...current,
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
  }, [loadAttempt, transfer])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: ValidationErrors = {}
    const amountCzk = parseAmountCzk(values.amountCzk)
    if (!values.sourceWalletId) nextErrors.sourceWalletId = 'Vyber odkud peníze převádíš.'
    if (!values.destinationWalletId) nextErrors.destinationWalletId = 'Vyber kam peníze převádíš.'
    if (values.sourceWalletId && values.sourceWalletId === values.destinationWalletId) nextErrors.destinationWalletId = 'Vyber jinou cílovou peněženku.'
    if (amountCzk === null) nextErrors.amountCzk = amountErrorMessage(values.amountCzk)
    if (!values.transferDate) nextErrors.transferDate = 'Vyber datum.'
    else if (transferMinDate && values.transferDate < transferMinDate) nextErrors.transferDate = 'Datum nemůže být před založením peněženky.'
    setErrors(nextErrors)
    setSubmissionError(null)
    if (Object.keys(nextErrors).length > 0 || amountCzk === null) return

    setIsSubmitting(true)
    try {
      const input = { sourceWalletId: values.sourceWalletId, destinationWalletId: values.destinationWalletId, amountCzk, transferDate: values.transferDate, note: values.note.trim() || null, labelIds: values.labelIds }
      if (transfer) await updateTransfer(transfer.id, input)
      else await createTransfer(input)
      onSaved()
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Převod se nepodařilo uložit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!transfer || !onDeleted) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteTransfer(transfer.id)
      onDeleted()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Převod se nepodařilo smazat.')
    } finally {
      setIsDeleting(false)
    }
  }

  return <section className="transaction-form-screen" aria-labelledby="transfer-form-title">
    <ScreenHeader
      title={transfer ? 'Upravit převod' : 'Nový převod'}
      titleId="transfer-form-title"
      backLabel="Zpět na transakce"
      onBack={onCancel}
      action={transfer ? <DeleteConfirmationDialog title="Smazat převod?" description="Tento převod bude trvale smazán." triggerLabel="Smazat převod" isDeleting={isDeleting} error={deleteError} onConfirm={() => void handleDelete()} /> : undefined}
    />
    {status === 'error' ? <LoadError title="Formulář se nepodařilo načíst" onRetry={() => setLoadAttempt((attempt) => attempt + 1)} /> : null}
    {status !== 'error' ? <form className="transaction-form transfer-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {submissionError ? <FormSubmissionError subject="Převod" action={transfer ? 'edit' : 'save'} message={submissionError} /> : null}
      <Card aria-label="Částka převodu" padding="none" className="transaction-amount-panel transfer-amount-panel">
        <div className="transfer-amount-panel__heading"><ArrowRightLeft aria-hidden="true" /><span>Převáděná částka</span></div>
        <AmountField autoFocus value={values.amountCzk} error={errors.amountCzk} onChange={(amountCzk) => setValues((current) => ({ ...current, amountCzk }))} onErrorChange={(amountCzk) => setErrors((current) => ({ ...current, amountCzk }))} />
      </Card>
      <div className="transaction-primary-pickers transfer-wallet-pickers">
        <Field invalid={Boolean(errors.sourceWalletId)} className="transaction-primary-picker">
          <FieldLabel>Z peněženky</FieldLabel>
          {status === 'loading' ? <Skeleton className="h-17 w-full" /> : <WalletPickerDialog wallets={wallets} selectedWallet={sourceWallet} placeholder="Vyber zdroj" onSelect={(sourceWalletId) => { setValues((current) => ({ ...current, sourceWalletId })); setErrors((current) => ({ ...current, sourceWalletId: undefined, destinationWalletId: values.destinationWalletId ? undefined : current.destinationWalletId, transferDate: undefined })) }} buttonClassName="transaction-primary-picker-button" />}
          <FieldError match={Boolean(errors.sourceWalletId)}>{errors.sourceWalletId}</FieldError>
        </Field>
        <Field invalid={Boolean(errors.destinationWalletId)} className="transaction-primary-picker">
          <FieldLabel>Do peněženky</FieldLabel>
          {status === 'loading' ? <Skeleton className="h-17 w-full" /> : <WalletPickerDialog wallets={wallets} selectedWallet={destinationWallet} placeholder="Vyber cíl" onSelect={(destinationWalletId) => { setValues((current) => ({ ...current, destinationWalletId })); setErrors((current) => ({ ...current, destinationWalletId: undefined, transferDate: undefined })) }} buttonClassName="transaction-primary-picker-button" />}
          <FieldError match={Boolean(errors.destinationWalletId)}>{errors.destinationWalletId}</FieldError>
        </Field>
      </div>
      {status === 'loading' ? <div className="transaction-labels"><FormLabel>Štítky</FormLabel><Skeleton className="h-9 w-32" /></div> : <InlineLabelPicker labels={labels} selectedIds={values.labelIds} onLabelsChange={setLabels} onValueChange={(labelIds) => setValues((current) => ({ ...current, labelIds }))} />}
      <section className="transaction-details" aria-label="Další podrobnosti">
        <Field invalid={Boolean(errors.transferDate)}>
          <FieldLabel>Datum</FieldLabel>
          <DatePicker className="transaction-date-picker" value={parseIsoDate(values.transferDate)} minDate={transferMinDate ? parseIsoDate(transferMinDate) : undefined} onValueChange={(date) => { setValues((current) => ({ ...current, transferDate: formatIsoDate(date) })); setErrors((current) => ({ ...current, transferDate: undefined })) }} locale="cs-CZ" startOfWeek={1} />
          <FieldError match={Boolean(errors.transferDate)}>{errors.transferDate}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Poznámka</FieldLabel>
          <Input value={values.note} placeholder="Volitelné" maxLength={MAX_NOTE_LENGTH} onChange={(event) => { const note = event.currentTarget.value; setValues((current) => ({ ...current, note })) }} />
        </Field>
      </section>
      <Button type="submit" size="lg" className="transaction-form-submit" loading={isSubmitting} disabled={status === 'loading' || wallets.length < 2}>{transfer ? 'Uložit změny' : 'Uložit převod'}</Button>
      {wallets.length < 2 ? <p className="transaction-form-hint">Pro převod potřebuješ alespoň dvě peněženky.</p> : null}
      {transfer && deleteError ? <FormSubmissionError subject="Převod" action="delete" message={deleteError} /> : null}
    </form> : null}
  </section>
}

function initialValues(transfer?: Transfer): TransferFormValues { return { sourceWalletId: transfer?.sourceWalletId ?? '', destinationWalletId: transfer?.destinationWalletId ?? '', amountCzk: transfer ? String(transfer.amountCzk) : '', transferDate: transfer?.transferDate ?? getPragueToday(), note: transfer?.note ?? '', labelIds: transfer?.labels.map((label) => label.id) ?? [] } }
