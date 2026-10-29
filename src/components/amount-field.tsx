import { applyAmountInput, createDecimalKeyBlocker, DECIMAL_INPUT_ERROR } from '../lib/amount-input'
import { Field, FieldError, FieldLabel } from './ui/field'
import { Input } from './ui/input'

type AmountFieldProps = {
  value: string
  error: string | undefined
  autoFocus?: boolean
  onChange: (value: string) => void
  onErrorChange: (error: string | undefined) => void
}

/** Whole-crowns amount input shared by the transaction, transfer and recurring-rule forms. */
export function AmountField({ value, error, autoFocus = false, onChange, onErrorChange }: AmountFieldProps) {
  return <Field invalid={Boolean(error)} className="transaction-amount-field">
    <FieldLabel>Částka</FieldLabel>
    <div className="transaction-amount">
      <Input
        autoFocus={autoFocus}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="next"
        value={value}
        placeholder="0"
        aria-label="Částka v korunách"
        onKeyDown={createDecimalKeyBlocker(() => onErrorChange(DECIMAL_INPUT_ERROR))}
        onChange={(event) => {
          const next = applyAmountInput(event.currentTarget.value, value)
          onErrorChange(next.error)
          onChange(next.value)
        }}
      />
      <span>Kč</span>
    </div>
    <FieldError match={Boolean(error)}>{error}</FieldError>
  </Field>
}
