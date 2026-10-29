import { parseIsoDate } from './prague-date'

/** "12 %" with at most `maximumFractionDigits` decimals (cs-CZ). */
export function formatPercent(value: number, maximumFractionDigits = 1) {
  return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits }).format(value)} %`
}

/** "1,2 mil. Kč": a short amount for chart axes. */
export function formatCompactMoney(value: number) {
  return `${new Intl.NumberFormat('cs-CZ', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} Kč`
}

/** "27. října 2026" from "YYYY-MM-DD". */
export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseIsoDate(value))
}

/** The Czech noun form that goes with a whole count: 1 -> `one`, 2-4 -> `few`, anything else (incl. 0) -> `many`. */
export function pluralCs(count: number, one: string, few: string, many: string) {
  return count === 1 ? one : count >= 2 && count <= 4 ? few : many
}

/** "3 položky": the count followed by the right form of the noun. */
export function formatCount(count: number, one: string, few: string, many: string) {
  return `${count} ${pluralCs(count, one, few, many)}`
}

export function formatItemCount(count: number) {
  return formatCount(count, 'položka', 'položky', 'položek')
}

export function formatTransactionCount(count: number) {
  return formatCount(count, 'transakce', 'transakce', 'transakcí')
}

/**
 * A span of years for display: under a year in months ("1 měsíc", "5 měsíců"), whole years with the
 * noun in agreement ("1 rok", "3 roky", "8 let"), and fractions in the genitive singular ("2,5 roku").
 */
export function formatYears(years: number) {
  if (years < 1) return formatCount(Math.round(years * 12), 'měsíc', 'měsíce', 'měsíců')

  const rounded = Math.round(years * 10) / 10
  if (Number.isInteger(rounded)) return formatCount(rounded, 'rok', 'roky', 'let')
  return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(rounded)} roku`
}

