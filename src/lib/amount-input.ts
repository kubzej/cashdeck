import type { KeyboardEvent } from 'react'

import { MAX_AMOUNT_CZK } from '../../server/src/catalog'

const DECIMAL_KEYS = new Set(['.', ','])
export const DECIMAL_INPUT_ERROR = 'Zadej celé koruny bez desetinných míst.'
export const SIGN_INPUT_ERROR = 'Částka nemůže začínat znaménkem.'
export const AMOUNT_TOO_LARGE_ERROR = 'Částka je příliš velká.'
export const SUM_NOT_POSITIVE_ERROR = 'Výsledek musí být větší než nula.'
const AMOUNT_REQUIRED_ERROR = 'Zadej celý počet korun větší než nula.'


export function createDecimalKeyBlocker(onBlocked: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (!DECIMAL_KEYS.has(event.key)) return
    event.preventDefault()
    onBlocked()
  }
}

/**
 * Decides what the amount field holds after the user typed or pasted `raw` over `previous`.
 *
 * The field takes whole crowns or a sum of them ("1 250 + 300 - 80"). Text that carries a decimal
 * separator or starts with a sign is rejected as a whole and the field keeps its previous value:
 * stripping the offending character instead turns "99,90" into 9990 and "-500" into 500, a silently
 * different amount. Czech "1 500,-" is whole crowns and is accepted. Anything else that is not a
 * digit, a space or a plus/minus (currency symbols, letters) is dropped.
 */
export function applyAmountInput(raw: string, previous: string): { value: string; error: string | undefined } {
  const withoutCzechDash = raw.replace(/[.,]\s*[-–—]\s*$/, '')
  if (/[.,]/.test(withoutCzechDash)) return { value: previous, error: DECIMAL_INPUT_ERROR }
  const normalized = withoutCzechDash.replaceAll(/[−–—]/g, '-')
  if (/^\s*[-+]/.test(normalized)) return { value: previous, error: SIGN_INPUT_ERROR }
  const cleaned = normalized.replaceAll(/[^0-9\s+-]/g, '').replaceAll(/[+-](\s*[+-])+/g, (run) => run.at(-1) ?? '')
  return { value: cleaned, error: undefined }
}

/** Whether the amount text is a sum or difference ("300 + 50") rather than a plain number. */
export function hasAmountOperator(value: string) {
  return /[+-]/.test(value)
}

/** Drops a dangling operator ("300 + ") so a half-typed sum still has a value to show. */
export function trimTrailingOperator(value: string) {
  return value.replace(/\s*[+-]\s*$/, '')
}

/** The total of a whole-crowns sum such as "1 250 + 300 - 80", or `null` if the text is not one. */
export function evaluateAmountExpression(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (!/^\d+([+-]\d+)*$/.test(normalized)) return null
  const total = (normalized.match(/[+-]?\d+/g) ?? []).reduce((sum, term) => sum + Number(term), 0)
  return Number.isSafeInteger(total) ? total : null
}

/** Parses an amount-input string (a number or a sum) into a positive whole CZK integer within the cap, or `null` if invalid. */
export function parseAmountCzk(value: string) {
  const amount = evaluateAmountExpression(value)
  return amount !== null && amount > 0 && amount <= MAX_AMOUNT_CZK ? amount : null
}

/** Parses a plain whole-number string into a positive CZK integer within the cap, or `null` if invalid. */
export function parsePositiveWholeCzk(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_AMOUNT_CZK ? amount : null
}

/** The message for an amount `parsePositiveWholeCzk` rejected: too large, or empty/zero/not a number. */
export function amountErrorMessage(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (/^\d+$/.test(normalized) && Number(normalized) > MAX_AMOUNT_CZK) return AMOUNT_TOO_LARGE_ERROR
  const total = evaluateAmountExpression(value)
  if (total !== null && total > MAX_AMOUNT_CZK) return AMOUNT_TOO_LARGE_ERROR
  if (total !== null && total <= 0 && hasAmountOperator(value)) return SUM_NOT_POSITIVE_ERROR
  return AMOUNT_REQUIRED_ERROR
}

/** A whole non-negative amount from a free-text field: empty means 0, anything else that is not a whole number is `null`. */
export function parseNonNegativeCzk(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (normalized === '') return 0
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

/** A whole amount that may be negative (an opening balance, an actual balance), or `null` if the text is not one. */
export function parseSignedWholeCzk(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (!/^-?\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

/** A decimal number written with `,` or `.` as the decimal mark, or `null` when the text is not one. */
export function parseDecimalInput(value: string) {
  const normalized = value.replace(',', '.').trim()
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

/** A percentage inside [min, max], or `null`. The range decides whether a negative one is allowed. */
export function parsePercentInput(value: string, min: number, max: number) {
  const amount = parseDecimalInput(value)
  return amount !== null && amount >= min && amount <= max ? amount : null
}

/** A whole number above zero, or `null`. */
export function parsePositiveInteger(value: string) {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

/** A whole number from zero up (empty means 0), or `null`. */
export function parseNonNegativeInteger(value: string) {
  const normalized = value.trim()
  if (normalized === '') return 0
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

// What-if scenarios save nothing, so they take any number apart from what the projection maths
// cannot handle: the lower bound is chosen where the formula stops being defined. The ceiling is
// no business limit either; it only keeps a typo such as 60000000000 from overflowing the chart.
export const MAX_SCENARIO_PERCENT = 10_000

export function parseScenarioPercent(value: string, lowerBound: { above: number } | { atLeast: number }) {
  const amount = parseDecimalInput(value)
  if (amount === null || amount > MAX_SCENARIO_PERCENT) return null
  const withinLowerBound = 'above' in lowerBound ? amount > lowerBound.above : amount >= lowerBound.atLeast
  return withinLowerBound ? amount : null
}

/**
 * The value of an optional what-if field: the parsed value when the text is usable, otherwise the
 * fallback. Text that is filled in but unusable also yields an error, so the field can say why the
 * result did not change; an empty field is not an error.
 */
export function resolveField<T>(text: string, parsed: T | null, fallback: T, message: string) {
  if (parsed !== null) return { value: parsed, error: undefined as string | undefined }
  return { value: fallback, error: text.trim() === '' ? undefined : message }
}
