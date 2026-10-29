import type { CategoryDirection, RecurringRuleKind } from '../catalog.js'
import { calculateTransferImpactCzk } from '../feed/domain.js'
import { asRecord, assertOnlyKeys, DomainError, parseCalendarDate, parseUuid } from '../management/domain.js'
import { getNextOccurrenceDate, getPragueToday, type RecurringFrequency } from '../recurring/schedule.js'
import { parseWalletIds } from '../parsing.js'

export type PlannedLabel = { id: string; name: string }

export type PlannedTransaction = {
  kind: 'transaction'
  origin: 'manual' | 'recurring'
  id: string
  recurringRuleId: string | null
  recurringRuleName: string | null
  walletId: string
  walletName: string
  categoryId: string
  categoryName: string
  categoryIconKey: string
  categoryColorKey: string
  direction: CategoryDirection
  amountCzk: number
  transactionDate: string
  note: string | null
  labels: PlannedLabel[]
}

export type PlannedTransfer = {
  kind: 'transfer'
  origin: 'manual' | 'recurring'
  id: string
  recurringRuleId: string | null
  recurringRuleName: string | null
  sourceWalletId: string
  sourceWalletName: string
  destinationWalletId: string
  destinationWalletName: string
  amountCzk: number
  impactCzk: number
  transferDate: string
  note: string | null
  labels: PlannedLabel[]
}

export type PlannedItem = PlannedTransaction | PlannedTransfer
export type PlannedSummary = { count: number; totalCzk: number }
export type PlannedListInput = { walletIds: string[] | null; dateFrom: string; dateTo: string; categoryId?: string; labelId?: string }
export type PlannedListResult = { items: PlannedItem[]; summary: PlannedSummary }

export type RecurringProjectionRule = {
  id: string
  name: string
  kind: RecurringRuleKind
  amountCzk: number
  walletId: string | null
  walletName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryIconKey: string | null
  categoryColorKey: string | null
  categoryDirection: CategoryDirection | null
  sourceWalletId: string | null
  sourceWalletName: string | null
  destinationWalletId: string | null
  destinationWalletName: string | null
  note: string | null
  labels: PlannedLabel[]
  frequency: RecurringFrequency
  customIntervalDays: number | null
  scheduleAnchorDate: string
  nextOccurrenceDate: string
  endsOn: string | null
}

// Recurring rules are projected in memory, one item per occurrence; two years keeps even a
// daily rule at ~730 items.
const MAX_PLANNED_RANGE_DAYS = 731

export function parsePlannedListQuery(value: unknown, today = getPragueToday()): PlannedListInput {
  const query = asRecord(value)
  assertOnlyKeys(query, ['walletIds', 'dateFrom', 'dateTo', 'categoryId', 'labelId'])
  const dateFrom = parseCalendarDate(query.dateFrom, 'Datum od')
  const dateTo = parseCalendarDate(query.dateTo, 'Datum do')
  if (dateFrom > dateTo) throw new DomainError(400, 'Datum od nesmí být po datu do.')
  // Measured from the first projected day: the past part of a range never generates items.
  const { dateFrom: projectedFrom } = getPlannedRange({ dateFrom, dateTo }, today)
  if (dateTo > addDays(projectedFrom, MAX_PLANNED_RANGE_DAYS)) throw new DomainError(400, 'Naplánované lze zobrazit nejvýš na dva roky dopředu.')
  return {
    walletIds: query.walletIds === undefined ? null : parseWalletIds(query.walletIds),
    dateFrom,
    dateTo,
    ...(query.categoryId === undefined ? {} : { categoryId: parseUuid(query.categoryId, 'Kategorie') }),
    ...(query.labelId === undefined ? {} : { labelId: parseUuid(query.labelId, 'Štítek') }),
  }
}

export function getPlannedRange(input: Pick<PlannedListInput, 'dateFrom' | 'dateTo'>, today = getPragueToday()) {
  const firstFutureDate = addDays(today, 1)
  return { dateFrom: input.dateFrom > firstFutureDate ? input.dateFrom : firstFutureDate, dateTo: input.dateTo }
}

export function projectRecurringRules(rules: RecurringProjectionRule[], input: PlannedListInput, today = getPragueToday()): PlannedItem[] {
  const range = getPlannedRange(input, today)
  if (range.dateFrom > range.dateTo) return []

  return rules
    .filter((rule) => !input.categoryId || (rule.kind === 'transaction' && rule.categoryId === input.categoryId))
    .filter((rule) => !input.labelId || rule.labels.some((label) => label.id === input.labelId))
    .flatMap((rule) => projectRule(rule, range.dateFrom, range.dateTo, input.walletIds))
}

export function summarizePlanned(items: PlannedItem[]): PlannedSummary {
  return items.reduce<PlannedSummary>((summary, item) => {
    const amount = item.kind === 'transaction'
      ? item.direction === 'income' ? item.amountCzk : -item.amountCzk
      : item.impactCzk
    return { count: summary.count + 1, totalCzk: summary.totalCzk + amount }
  }, { count: 0, totalCzk: 0 })
}

export function sortPlannedItems(items: PlannedItem[]) {
  return [...items].sort((left, right) => {
    const dateComparison = getPlannedItemDate(left).localeCompare(getPlannedItemDate(right))
    if (dateComparison !== 0) return dateComparison
    return left.id.localeCompare(right.id)
  })
}

export function getPlannedItemDate(item: PlannedItem) {
  return item.kind === 'transaction' ? item.transactionDate : item.transferDate
}

function projectRule(rule: RecurringProjectionRule, dateFrom: string, dateTo: string, selectedWalletIds: string[] | null): PlannedItem[] {
  const items: PlannedItem[] = []
  let occurrenceDate = rule.nextOccurrenceDate

  while (occurrenceDate < dateFrom && (rule.endsOn === null || occurrenceDate <= rule.endsOn)) {
    occurrenceDate = getNextOccurrenceDate({
      frequency: rule.frequency,
      customIntervalDays: rule.customIntervalDays,
      scheduleAnchorDate: rule.scheduleAnchorDate,
      nextOccurrenceDate: occurrenceDate,
    })
  }

  while (occurrenceDate <= dateTo && (rule.endsOn === null || occurrenceDate <= rule.endsOn)) {
    items.push(toProjectedItem(rule, occurrenceDate, selectedWalletIds))
    occurrenceDate = getNextOccurrenceDate({
      frequency: rule.frequency,
      customIntervalDays: rule.customIntervalDays,
      scheduleAnchorDate: rule.scheduleAnchorDate,
      nextOccurrenceDate: occurrenceDate,
    })
  }

  return items
}

function toProjectedItem(rule: RecurringProjectionRule, occurrenceDate: string, selectedWalletIds: string[] | null): PlannedItem {
  const id = `${rule.id}:${occurrenceDate}`
  if (rule.kind === 'transaction') {
    if (!rule.walletId || !rule.walletName || !rule.categoryId || !rule.categoryName || !rule.categoryIconKey || !rule.categoryColorKey || !rule.categoryDirection) throw new Error('Opakování transakce nemá úplná data.')
    return {
      kind: 'transaction', origin: 'recurring', id, recurringRuleId: rule.id, recurringRuleName: rule.name,
      walletId: rule.walletId, walletName: rule.walletName, categoryId: rule.categoryId, categoryName: rule.categoryName,
      categoryIconKey: rule.categoryIconKey, categoryColorKey: rule.categoryColorKey, direction: rule.categoryDirection,
      amountCzk: rule.amountCzk, transactionDate: occurrenceDate, note: rule.note, labels: rule.labels,
    }
  }

  if (!rule.sourceWalletId || !rule.sourceWalletName || !rule.destinationWalletId || !rule.destinationWalletName) throw new Error('Opakování převodu nemá úplná data.')
  return {
    kind: 'transfer', origin: 'recurring', id, recurringRuleId: rule.id, recurringRuleName: rule.name,
    sourceWalletId: rule.sourceWalletId, sourceWalletName: rule.sourceWalletName,
    destinationWalletId: rule.destinationWalletId, destinationWalletName: rule.destinationWalletName,
    amountCzk: rule.amountCzk,
    impactCzk: calculateTransferImpactCzk({ amountCzk: rule.amountCzk, sourceWalletId: rule.sourceWalletId, destinationWalletId: rule.destinationWalletId, selectedWalletIds }),
    transferDate: occurrenceDate, note: rule.note, labels: rule.labels,
  }
}

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + amount)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
