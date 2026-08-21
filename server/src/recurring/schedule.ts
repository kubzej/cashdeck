export type RecurringFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'every_two_months'
  | 'every_three_months'
  | 'semiannual'
  | 'yearly'
  | 'custom_days'

export type RecurringSchedule = {
  frequency: RecurringFrequency
  customIntervalDays: number | null
  scheduleAnchorDate: string
  nextOccurrenceDate: string
}

export function getNextOccurrenceDate(schedule: RecurringSchedule): string {
  const next = parseCalendarDate(schedule.nextOccurrenceDate)
  const anchor = parseCalendarDate(schedule.scheduleAnchorDate)

  switch (schedule.frequency) {
    case 'daily': return formatCalendarDate(addDays(next, 1))
    case 'weekly': return formatCalendarDate(addDays(next, 7))
    case 'biweekly': return formatCalendarDate(addDays(next, 14))
    case 'custom_days': return formatCalendarDate(addDays(next, requireCustomInterval(schedule.customIntervalDays)))
    case 'monthly': return formatCalendarDate(addCalendarMonths(next, anchor.getDate(), 1))
    case 'every_two_months': return formatCalendarDate(addCalendarMonths(next, anchor.getDate(), 2))
    case 'every_three_months': return formatCalendarDate(addCalendarMonths(next, anchor.getDate(), 3))
    case 'semiannual': return formatCalendarDate(addCalendarMonths(next, anchor.getDate(), 6))
    case 'yearly': return formatCalendarDate(addCalendarMonths(next, anchor.getDate(), 12))
  }
}

export function isRecurringOccurrenceDue({ nextOccurrenceDate, endsOn, today }: Pick<RecurringSchedule, 'nextOccurrenceDate'> & { endsOn: string | null; today: string }) {
return nextOccurrenceDate <= today && (endsOn === null || nextOccurrenceDate <= endsOn)
}

export function isRecurringRuleEnded({ nextOccurrenceDate, endsOn }: Pick<RecurringSchedule, 'nextOccurrenceDate'> & { endsOn: string | null }) {
  return endsOn !== null && nextOccurrenceDate > endsOn
}

export function getPragueToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addCalendarMonths(date: Date, anchorDay: number, months: number) {
  const year = date.getFullYear()
  const month = date.getMonth() + months
  const targetYear = year + Math.floor(month / 12)
  const targetMonth = ((month % 12) + 12) % 12
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  return new Date(targetYear, targetMonth, Math.min(anchorDay, lastDay))
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function requireCustomInterval(value: number | null): number {
  if (value === null || !Number.isInteger(value) || value < 1) throw new Error('Custom recurring interval must be a positive whole number.')
  return value
}

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Recurring schedule date must use YYYY-MM-DD.')
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (formatCalendarDate(date) !== value) throw new Error('Recurring schedule date must be a real calendar date.')
  return date
}

function formatCalendarDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
