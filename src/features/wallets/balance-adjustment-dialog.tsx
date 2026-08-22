import { useMemo, useState, type FormEvent } from 'react'
import { CircleAlert, Scale } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { createDecimalKeyBlocker } from '../../lib/amount-input'
import { formatCzk } from '../../lib/format-czk'
import { createBalanceAdjustment, type Wallet } from './api'

export function BalanceAdjustmentDialog({ wallet, onOpenChange, onAdjusted }: { wallet: Wallet; onOpenChange: (open: boolean) => void; onAdjusted: () => void }) {
  const recordedBalance = wallet.currentBalanceCzk ?? wallet.openingBalanceCzk
  const [actualBalance, setActualBalance] = useState(() => formatWholeNumber(recordedBalance))
  const [hasDecimalInput, setHasDecimalInput] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const parsedActualBalance = useMemo(() => parseWholeCzk(actualBalance), [actualBalance])
  const difference = parsedActualBalance === null ? null : parsedActualBalance - recordedBalance

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (hasDecimalInput || parsedActualBalance === null || difference === 0) return
    setSubmissionError(null)
    setIsSubmitting(true)
    try {
      await createBalanceAdjustment(wallet.id, parsedActualBalance)
      onAdjusted()
      onOpenChange(false)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Vyrovnání zůstatku se nepodařilo uložit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isInvalid = hasDecimalInput || (actualBalance.trim() !== '' && parsedActualBalance === null)

  return <Dialog open onOpenChange={onOpenChange}>
    <DialogContent size="sm" className="balance-adjustment-dialog">
      <form onClick={(event) => event.stopPropagation()} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <DialogHeader>
          <DialogTitle>Vyrovnat zůstatek</DialogTitle>
          <DialogDescription>Porovnej evidovaný zůstatek se skutečným stavem peněženky {wallet.name}.</DialogDescription>
        </DialogHeader>
        <DialogBody className="balance-adjustment-dialog__body">
          <div className="balance-adjustment-dialog__recorded"><Scale aria-hidden="true" /><span>Evidovaný zůstatek</span><strong>{formatCzk(recordedBalance)}</strong></div>
          <Field invalid={isInvalid}>
            <FieldLabel>Skutečný zůstatek</FieldLabel>
            <Input autoFocus inputMode="numeric" pattern="-?[0-9 ]*" value={actualBalance} placeholder="0" aria-label="Skutečný zůstatek v korunách" onFocus={(event) => event.currentTarget.select()} onKeyDown={createDecimalKeyBlocker(() => setHasDecimalInput(true))} onChange={(event) => { const raw = event.currentTarget.value; setHasDecimalInput(/[.,]/.test(raw)); setActualBalance(raw.replaceAll(/[^0-9\s-]/g, '')) }} />
            <FieldDescription>Zadej aktuální stav z banky nebo hotovosti.</FieldDescription>
            <FieldError match={isInvalid}>{hasDecimalInput ? 'Zadej celé koruny bez desetinných míst.' : 'Zadej celý počet korun.'}</FieldError>
          </Field>
          {difference !== null && !isInvalid ? <p className={`balance-adjustment-dialog__difference ${difference === 0 ? 'balance-adjustment-dialog__difference--same' : difference > 0 ? 'balance-adjustment-dialog__difference--add' : 'balance-adjustment-dialog__difference--subtract'}`}>{difference === 0 ? 'Zůstatek už souhlasí.' : difference > 0 ? `Přidá se ${formatCzk(difference)}.` : `Odečte se ${formatCzk(Math.abs(difference))}.`}</p> : null}
          {submissionError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Vyrovnání se nepodařilo uložit</FeedbackStateTitle><FeedbackStateDescription>{submissionError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" disabled={isSubmitting} />}>Zrušit</DialogClose>
          <Button type="submit" loading={isSubmitting} disabled={hasDecimalInput || parsedActualBalance === null || difference === 0}>Vyrovnat zůstatek</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

function parseWholeCzk(value: string) {
  const normalized = value.replaceAll(' ', '').replaceAll('\u00a0', '')
  if (!/^-?\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

function formatWholeNumber(value: number) { return new Intl.NumberFormat('cs-CZ').format(value) }
