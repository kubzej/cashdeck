import { useState, type FormEvent } from 'react'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ColorPicker } from '../../components/color-picker'
import { DeleteConfirmationDialog } from '../../components/delete-confirmation-dialog'
import { DatePicker } from '../../components/ui/calendar'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { createWallet, deleteWallet, updateWallet, type Wallet, type WalletColorKey } from './api'
import './wallets.css'

type WalletFormValues = {
  name: string
  colorKey: WalletColorKey
  openingBalanceCzk: string
  openingBalanceDate: string
}

export function WalletFormScreen({ wallet, onCancel, onSaved, onDeleted }: { wallet?: Wallet; onCancel: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const openingBalanceLocked = Boolean(wallet?.openingBalanceLocked)
  const [values, setValues] = useState<WalletFormValues>({
    name: wallet?.name ?? '',
    colorKey: wallet?.colorKey ?? 'teal',
    openingBalanceCzk: wallet ? String(wallet.openingBalanceCzk) : '',
    openingBalanceDate: wallet ? wallet.openingBalanceDate.slice(0, 10) : getPragueToday(),
  })
  const [errors, setErrors] = useState<Partial<Record<keyof WalletFormValues, string>>>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof WalletFormValues, string>> = {}
    const openingBalanceCzk = parseWholeCzk(values.openingBalanceCzk)
    if (!values.name.trim()) nextErrors.name = 'Zadej název peněženky.'
    if (!openingBalanceLocked && openingBalanceCzk === null) nextErrors.openingBalanceCzk = 'Zadej celý počet korun.'
    if (!openingBalanceLocked && !values.openingBalanceDate) nextErrors.openingBalanceDate = 'Vyber datum.'
    setErrors(nextErrors)
    setSubmissionError(null)
    if (Object.keys(nextErrors).length > 0 || openingBalanceCzk === null) return

    setIsSubmitting(true)
    try {
      const mutableInput = { name: values.name.trim(), colorKey: values.colorKey }
      if (wallet) {
        await updateWallet(wallet.id, openingBalanceLocked ? mutableInput : { ...mutableInput, openingBalanceCzk, openingBalanceDate: values.openingBalanceDate })
      } else {
        await createWallet({ ...mutableInput, openingBalanceCzk, openingBalanceDate: values.openingBalanceDate })
      }
      onSaved()
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Peněženku se nepodařilo uložit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!wallet || !onDeleted) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteWallet(wallet.id)
      onDeleted()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Peněženku se nepodařilo smazat.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="wallet-form-screen" aria-labelledby="wallet-form-title">
      <header className="wallet-form-header">
        <Button variant="ghost" size="icon" aria-label="Zpět na peněženky" onClick={onCancel}><ArrowLeft aria-hidden="true" /></Button>
        <h1 id="wallet-form-title">{wallet ? 'Upravit peněženku' : 'Nová peněženka'}</h1>
        {wallet ? <DeleteConfirmationDialog title="Smazat peněženku?" description={`Peněženka „${wallet.name}“ bude trvale smazána.`} triggerLabel="Smazat peněženku" isDeleting={isDeleting} onConfirm={() => void handleDelete()} /> : <span aria-hidden="true" />}
      </header>
      <form className="wallet-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {submissionError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Peněženku se nepodařilo uložit</FeedbackStateTitle><FeedbackStateDescription>{submissionError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
        <Field invalid={Boolean(errors.name)}>
          <FieldLabel>Název</FieldLabel>
          <Input autoFocus value={values.name} placeholder="Např. Hotovost" onChange={(event) => { const name = event.currentTarget.value; setValues((current) => ({ ...current, name })) }} />
          <FieldError match={Boolean(errors.name)}>{errors.name}</FieldError>
        </Field>
        <fieldset className="wallet-color-field">
          <legend>Barva</legend>
          <ColorPicker value={values.colorKey} ariaLabel="Barva peněženky" onValueChange={(colorKey) => setValues((current) => ({ ...current, colorKey: colorKey as WalletColorKey }))} />
        </fieldset>
        <Field invalid={Boolean(errors.openingBalanceCzk)}>
          <FieldLabel>Počáteční zůstatek</FieldLabel>
          <Input type="text" inputMode="numeric" value={values.openingBalanceCzk} placeholder="0" disabled={openingBalanceLocked} onChange={(event) => { const openingBalanceCzk = event.currentTarget.value; setValues((current) => ({ ...current, openingBalanceCzk })) }} />
          {openingBalanceLocked ? <FieldDescription>Po první aktivitě peněženky jej nelze měnit.</FieldDescription> : null}
          <FieldError match={Boolean(errors.openingBalanceCzk)}>{errors.openingBalanceCzk}</FieldError>
        </Field>
        <Field invalid={Boolean(errors.openingBalanceDate)}>
          <FieldLabel>Datum počátečního zůstatku</FieldLabel>
          <DatePicker value={parseIsoDate(values.openingBalanceDate)} disabled={openingBalanceLocked} onValueChange={(date) => setValues((current) => ({ ...current, openingBalanceDate: formatIsoDate(date) }))} locale="cs-CZ" startOfWeek={1} />
          <FieldError match={Boolean(errors.openingBalanceDate)}>{errors.openingBalanceDate}</FieldError>
        </Field>
        <Button type="submit" size="lg" className="wallet-form-submit" loading={isSubmitting}>{wallet ? 'Uložit změny' : 'Uložit peněženku'}</Button>
        {wallet && deleteError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Peněženku se nepodařilo smazat</FeedbackStateTitle><FeedbackStateDescription>{deleteError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
      </form>
    </section>
  )
}

function parseWholeCzk(value: string) {
  const normalized = value.replaceAll(' ', '').replaceAll('\u00a0', '')
  if (!/^-?\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

function getPragueToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function parseIsoDate(value: string) { const [year, month, day] = value.slice(0, 10).split('-').map(Number); return new Date(year, month - 1, day) }
function formatIsoDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` }
