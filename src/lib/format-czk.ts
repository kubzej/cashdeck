const wholeNumberFormatter = new Intl.NumberFormat('cs-CZ')

/** Formats a whole-CZK amount as e.g. "125 000 Kč". Pass `signed: true` for a leading +/- sign. */
export function formatCzk(value: number, options: { signed?: boolean } = {}) {
  const prefix = options.signed ? (value > 0 ? '+' : value < 0 ? '-' : '') : ''
  return `${prefix}${wholeNumberFormatter.format(Math.abs(value))} Kč`
}
