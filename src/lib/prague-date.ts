/** Today's calendar date in Europe/Prague, as "YYYY-MM-DD". */
export function getPragueToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** Parses a "YYYY-MM-DD" (optionally with a trailing time/offset) into a local Date at midnight. */
export function parseIsoDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Formats a local Date as "YYYY-MM-DD". */
export function formatIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
