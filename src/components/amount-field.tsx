import { useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { applyAmountInput, createDecimalKeyBlocker, DECIMAL_INPUT_ERROR, evaluateAmountExpression, amountErrorMessage, hasAmountOperator, parseAmountCzk, trimTrailingOperator } from '../lib/amount-input'
import { formatCzk } from '../lib/format-czk'
import { Button } from './ui/button'
import { Field, FieldError, FieldLabel } from './ui/field'
import { Input } from './ui/input'

type AmountFieldProps = {
  value: string
  error: string | undefined
  autoFocus?: boolean
  onChange: (value: string) => void
  onErrorChange: (error: string | undefined) => void
}

/**
 * Whole-crowns amount input shared by the transaction, transfer and recurring-rule forms. Besides
 * a plain number it takes a sum ("1 250 + 300 - 80"): the iOS numeric keyboard has no plus or minus,
 * so the buttons under the field type them, and the result shows live and replaces the sum on blur.
 */
export function AmountField({ value, error, autoFocus = false, onChange, onErrorChange }: AmountFieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const isSum = hasAmountOperator(value)
  const total = isSum ? evaluateAmountExpression(trimTrailingOperator(value)) : null
  const canAddOperator = /\d/.test(value)

  function addOperator(operator: '+' | '-') {
    onErrorChange(undefined)
    onChange(`${trimTrailingOperator(value)} ${operator} `)
    wrapRef.current?.querySelector('input')?.focus()
  }

  function collapseSum() {
    if (!isSum) return
    const amount = parseAmountCzk(trimTrailingOperator(value))
    if (amount !== null) onChange(String(amount))
    else if (total !== null) onErrorChange(amountErrorMessage(trimTrailingOperator(value)))
  }

  return <Field invalid={Boolean(error)} className="transaction-amount-field">
    <div className="transaction-amount-head">
      <FieldLabel>Částka</FieldLabel>
      <div className="transaction-amount-tools">
        <Button type="button" variant="secondary" size="icon" aria-label="Přičíst" disabled={!canAddOperator} onMouseDown={(event) => event.preventDefault()} onClick={() => addOperator('+')}><Plus aria-hidden="true" /></Button>
        <Button type="button" variant="secondary" size="icon" aria-label="Odečíst" disabled={!canAddOperator} onMouseDown={(event) => event.preventDefault()} onClick={() => addOperator('-')}><Minus aria-hidden="true" /></Button>
      </div>
    </div>
    <div className={isSum ? 'transaction-amount transaction-amount--sum' : 'transaction-amount'} ref={wrapRef}>
      <Input
        autoFocus={autoFocus}
        type="text"
        inputMode="numeric"
        pattern="[0-9 +\-]*"
        enterKeyHint="next"
        value={value}
        placeholder="0"
        aria-label="Částka v korunách"
        onKeyDown={createDecimalKeyBlocker(() => onErrorChange(DECIMAL_INPUT_ERROR))}
        onBlur={collapseSum}
        onChange={(event) => {
          const next = applyAmountInput(event.currentTarget.value, value)
          onErrorChange(next.error)
          onChange(next.value)
        }}
      />
      {/* The total is typed after the sum itself, like a formula: the ghost repeats the value invisibly so "= total" lands right behind the last character. */}
      {total !== null ? <span className={total > 0 ? 'transaction-amount-ghost' : 'transaction-amount-ghost transaction-amount-ghost--invalid'} aria-live="polite"><span>{value}</span> = {formatCzk(total, { signed: true }).replace(/^\+/, '').replace(/\s*Kč$/, '')}</span> : null}
      <span>Kč</span>
    </div>
    <FieldError match={Boolean(error)}>{error}</FieldError>
  </Field>
}
