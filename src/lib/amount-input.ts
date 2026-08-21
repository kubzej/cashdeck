import type { KeyboardEvent } from 'react'

const DECIMAL_KEYS = new Set(['.', ','])
export const DECIMAL_INPUT_ERROR = 'Zadej celé koruny bez desetinných míst.'

export function createDecimalKeyBlocker(onBlocked: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (!DECIMAL_KEYS.has(event.key)) return
    event.preventDefault()
    onBlocked()
  }
}

export function sanitizeAmountInput(raw: string): { value: string; error: string | undefined } {
  const hasDecimal = /[.,]/.test(raw)
  const value = raw.replaceAll(/[^0-9\s]/g, '')
  return { value, error: hasDecimal ? DECIMAL_INPUT_ERROR : undefined }
}

/** Parses a sanitized amount-input string into a positive whole CZK integer, or `null` if invalid. */
export function parsePositiveWholeCzk(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}
