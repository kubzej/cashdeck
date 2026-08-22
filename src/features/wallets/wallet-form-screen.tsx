import { useEffect, useState, type FormEvent } from 'react'
import { CircleAlert, Eye, EyeOff, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { ColorPicker } from '../../components/color-picker'
import { DeleteConfirmationDialog } from '../../components/delete-confirmation-dialog'
import { ScreenHeader } from '../../components/screen-header'
import { DatePicker } from '../../components/ui/calendar'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { getIndependenceSettings } from '../independence/api'
import { formatIsoDate, getPragueToday, parseIsoDate } from '../../lib/prague-date'
import { createWallet, deleteWallet, updateWallet, type Wallet, type WalletColorKey, type WalletType } from './api'
import { WalletTypePicker } from './wallet-type-icon'
import './wallets.css'

type WalletFormValues = {
  name: string
  colorKey: WalletColorKey
  walletType: WalletType
  countsTowardIndependence: boolean
  availableNow: boolean
  openingBalanceCzk: string
  openingBalanceDate: string
}

export function WalletFormScreen({ wallet, onCancel, onSaved, onDeleted }: { wallet?: Wallet; onCancel: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const openingBalanceLocked = Boolean(wallet?.openingBalanceLocked)
  const [values, setValues] = useState<WalletFormValues>({
    name: wallet?.name ?? '',
    colorKey: wallet?.colorKey ?? 'teal',
    walletType: wallet?.walletType ?? 'other',
    countsTowardIndependence: wallet?.countsTowardIndependence ?? false,
    availableNow: wallet?.availableNow ?? false,
    openingBalanceCzk: wallet ? String(wallet.openingBalanceCzk) : '',
    openingBalanceDate: wallet ? wallet.openingBalanceDate.slice(0, 10) : getPragueToday(),
  })
  const [errors, setErrors] = useState<Partial<Record<keyof WalletFormValues, string>>>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [visibilityError, setVisibilityError] = useState<string | null>(null)
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false)
  const [showIndependenceFields, setShowIndependenceFields] = useState(false)

  useEffect(() => {
    void getIndependenceSettings().then((result) => setShowIndependenceFields(result.settings !== null)).catch(() => setShowIndependenceFields(false))
  }, [])

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
      const mutableInput = {
        name: values.name.trim(),
        colorKey: values.colorKey,
        walletType: values.walletType,
        ...(showIndependenceFields ? { countsTowardIndependence: values.countsTowardIndependence, availableNow: values.availableNow } : {}),
      }
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

  async function handleToggleVisibility() {
    if (!wallet) return
    setVisibilityError(null)
    setIsTogglingVisibility(true)
    try {
      await updateWallet(wallet.id, { isHidden: !wallet.isHidden })
      onSaved()
    } catch (error) {
      setVisibilityError(error instanceof Error ? error.message : 'Viditelnost peněženky se nepodařilo změnit.')
    } finally {
      setIsTogglingVisibility(false)
    }
  }

  return (
    <section className="wallet-form-screen" aria-labelledby="wallet-form-title">
      <ScreenHeader
        title={wallet ? 'Upravit peněženku' : 'Nová peněženka'}
        titleId="wallet-form-title"
        backLabel="Zpět na peněženky"
        onBack={onCancel}
        action={wallet ? (
          wallet.isHidden ? (
            <Button variant="ghost" size="icon" aria-label="Zobrazit peněženku" title="Zobrazit peněženku" loading={isTogglingVisibility} onClick={() => void handleToggleVisibility()}>
              <Eye aria-hidden="true" />
            </Button>
          ) : openingBalanceLocked ? (
            <Button variant="ghost" size="icon" aria-label="Skrýt peněženku" title="Skrýt peněženku" loading={isTogglingVisibility} onClick={() => void handleToggleVisibility()}>
              <EyeOff aria-hidden="true" />
            </Button>
          ) : (
            <DeleteConfirmationDialog title="Smazat peněženku?" description={`Peněženka „${wallet.name}“ bude trvale smazána.`} triggerLabel="Smazat peněženku" isDeleting={isDeleting} onConfirm={() => void handleDelete()} />
          )
        ) : undefined}
      />
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
        <fieldset className="wallet-color-field">
          <legend>Typ peněženky</legend>
          <WalletTypePicker value={values.walletType} ariaLabel="Typ peněženky" onValueChange={(walletType) => setValues((current) => ({ ...current, walletType }))} />
        </fieldset>
        {showIndependenceFields ? (
          <Card render={<fieldset />} padding="none" className="wallet-independence-field">
            <legend><Sparkles aria-hidden="true" /> Nezávislost</legend>
            <Field>
              <FieldLabel>Počítá se do nezávislosti?</FieldLabel>
              <ToggleGroup type="single" width="full" value={values.countsTowardIndependence ? 'yes' : 'no'} className="wallet-independence-toggle" aria-label="Počítá se do nezávislosti?" onValueChange={(next) => { if (!next) return; const countsTowardIndependence = next === 'yes'; setValues((current) => ({ ...current, countsTowardIndependence, availableNow: countsTowardIndependence ? current.availableNow : false })) }}>
                <ToggleGroupItem value="no">Ne</ToggleGroupItem>
                <ToggleGroupItem value="yes">Ano</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {values.countsTowardIndependence ? <Field>
              <FieldLabel>Dostupné hned?</FieldLabel>
              <ToggleGroup type="single" width="full" value={values.availableNow ? 'yes' : 'no'} className="wallet-independence-toggle" aria-label="Dostupné hned?" onValueChange={(next) => { if (next) setValues((current) => ({ ...current, availableNow: next === 'yes' })) }}>
                <ToggleGroupItem value="no">Ne</ToggleGroupItem>
                <ToggleGroupItem value="yes">Ano</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>Vypni, pokud jsou peníze zamčené (např. penzijní spoření před 60 lety).</FieldDescription>
            </Field> : null}
          </Card>
        ) : null}
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
        {wallet && visibilityError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Viditelnost se nepodařilo změnit</FeedbackStateTitle><FeedbackStateDescription>{visibilityError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
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

