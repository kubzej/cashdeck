import {
  asRecord,
  assertOnlyKeys,
  DomainError,
  parseCalendarDate,
  parseUuid,
  parseWholeCzk,
} from '../management/domain.js'
import { assertDifferentWallets } from '../transfers/domain.js'
import { getPragueToday, type RecurringFrequency } from './schedule.js'

export const recurringRuleKinds = ['transaction', 'transfer'] as const
export type RecurringRuleKind = (typeof recurringRuleKinds)[number]

const recurringFrequencies: readonly RecurringFrequency[] = [
  'daily', 'weekly', 'biweekly', 'monthly', 'every_two_months',
  'every_three_months', 'semiannual', 'yearly', 'custom_days',
]

export type RecurringRuleInput = {
  name: string
  kind: RecurringRuleKind
  amountCzk: number
  walletId: string | null
  categoryId: string | null
  sourceWalletId: string | null
  destinationWalletId: string | null
  note: string | null
  labelIds: string[]
  frequency: RecurringFrequency
  customIntervalDays: number | null
  nextOccurrenceDate: string
  endsOn: string | null
}

export function parseRecurringRule(body: unknown, today = getPragueToday()): RecurringRuleInput {
  const value = asRecord(body)
  assertOnlyKeys(value, [
    'name', 'kind', 'amountCzk', 'walletId', 'categoryId', 'sourceWalletId', 'destinationWalletId',
    'note', 'labelIds', 'frequency', 'customIntervalDays', 'nextOccurrenceDate', 'endsOn',
  ])

  const kind = parseKind(value.kind)
  const nextOccurrenceDate = parseCalendarDate(value.nextOccurrenceDate, 'Další výskyt')
  if (nextOccurrenceDate < today) throw new DomainError(400, 'Další výskyt musí být dnes nebo v budoucnu.')

  const endsOn = parseOptionalDate(value.endsOn, 'Konec opakování')
  if (endsOn !== null && endsOn < nextOccurrenceDate) {
    throw new DomainError(400, 'Konec opakování nesmí být před dalším výskytem.')
  }

  const input: RecurringRuleInput = {
    name: parseName(value.name),
    kind,
    amountCzk: parsePositiveAmount(value.amountCzk),
    walletId: null,
    categoryId: null,
    sourceWalletId: null,
    destinationWalletId: null,
    note: parseOptionalNote(value.note),
    labelIds: parseLabelIds(value.labelIds),
    frequency: parseFrequency(value.frequency),
    customIntervalDays: parseCustomInterval(value.frequency, value.customIntervalDays),
    nextOccurrenceDate,
    endsOn,
  }

  if (kind === 'transaction') {
    input.walletId = parseUuid(value.walletId, 'Peněženka')
    input.categoryId = parseUuid(value.categoryId, 'Kategorie')
    if (value.sourceWalletId !== undefined || value.destinationWalletId !== undefined) {
      throw new DomainError(400, 'Transakce nesmí obsahovat peněženky převodu.')
    }
  } else {
    input.sourceWalletId = parseUuid(value.sourceWalletId, 'Zdrojová peněženka')
    input.destinationWalletId = parseUuid(value.destinationWalletId, 'Cílová peněženka')
    assertDifferentWallets(input.sourceWalletId, input.destinationWalletId)
    if (value.walletId !== undefined || value.categoryId !== undefined) {
      throw new DomainError(400, 'Převod nesmí obsahovat kategorii ani peněženku transakce.')
    }
  }

  return input
}

export function parseRecurringRuleListQuery(value: unknown) {
  const query = asRecord(value)
  assertOnlyKeys(query, [])
  return undefined
}

function parseKind(value: unknown): RecurringRuleKind {
  if (typeof value === 'string' && (recurringRuleKinds as readonly string[]).includes(value)) return value as RecurringRuleKind
  throw new DomainError(400, 'Typ opakování musí být transakce nebo převod.')
}

function parseFrequency(value: unknown): RecurringFrequency {
  if (typeof value === 'string' && recurringFrequencies.includes(value as RecurringFrequency)) return value as RecurringFrequency
  throw new DomainError(400, 'Frekvence opakování není podporovaná.')
}

function parseCustomInterval(frequencyValue: unknown, value: unknown) {
  if (frequencyValue !== 'custom_days') {
    if (value !== undefined && value !== null) throw new DomainError(400, 'Vlastní interval patří jen k opakování po dnech.')
    return null
  }
  const interval = parseWholeCzk(value, 'Vlastní interval', { allowNegative: false })
  if (interval < 1 || interval > 3650) throw new DomainError(400, 'Vlastní interval musí být mezi 1 a 3 650 dny.')
  return interval
}

function parseName(value: unknown) {
  if (typeof value !== 'string') throw new DomainError(400, 'Název opakování je povinný.')
  const name = value.trim()
  if (!name || name.length > 120) throw new DomainError(400, 'Název opakování musí mít 1 až 120 znaků.')
  return name
}

function parsePositiveAmount(value: unknown) {
  const amount = parseWholeCzk(value, 'Částka', { allowNegative: false })
  if (amount < 1) throw new DomainError(400, 'Částka musí být alespoň 1 Kč.')
  return amount
}

function parseOptionalNote(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new DomainError(400, 'Poznámka musí být text.')
  const note = value.trim()
  if (!note) return null
  if (note.length > 2000) throw new DomainError(400, 'Poznámka může mít nejvýše 2 000 znaků.')
  return note
}

function parseLabelIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new DomainError(400, 'Štítky musí být seznam ID.')
  const labelIds = value.map((labelId) => parseUuid(labelId, 'Štítek'))
  if (labelIds.length !== new Set(labelIds).size) throw new DomainError(400, 'Štítky se nesmí opakovat.')
  return labelIds
}

function parseOptionalDate(value: unknown, field: string) {
  if (value === null || value === undefined) return null
  return parseCalendarDate(value, field)
}
