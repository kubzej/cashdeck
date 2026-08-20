import type { CategoryDirection } from '../categories/api'
import type { RecurringFrequency, RecurringRule, RecurringRuleInput, RecurringRuleKind } from './api'

export type RecurringRuleFormValues = {
  name: string
  kind: RecurringRuleKind
  direction: CategoryDirection
  amountCzk: string
  walletId: string
  categoryId: string
  sourceWalletId: string
  destinationWalletId: string
  note: string
  labelIds: string[]
  frequency: RecurringFrequency
  customIntervalDays: string
  nextOccurrenceDate: string
  endsOn: string
}

export type RecurringRuleFormErrors = Partial<Record<'name' | 'amountCzk' | 'walletId' | 'categoryId' | 'sourceWalletId' | 'destinationWalletId' | 'nextOccurrenceDate' | 'endsOn' | 'customIntervalDays', string>>

export function initialRecurringRuleFormValues(rule: RecurringRule | undefined, today: string): RecurringRuleFormValues {
  return {
    name: rule?.name ?? '',
    kind: rule?.kind ?? 'transaction',
    direction: rule?.categoryDirection ?? 'expense',
    amountCzk: rule ? String(rule.amountCzk) : '',
    walletId: rule?.walletId ?? '',
    categoryId: rule?.categoryId ?? '',
    sourceWalletId: rule?.sourceWalletId ?? '',
    destinationWalletId: rule?.destinationWalletId ?? '',
    note: rule?.note ?? '',
    labelIds: rule?.labels.map((label) => label.id) ?? [],
    frequency: rule?.frequency ?? 'monthly',
    customIntervalDays: rule?.customIntervalDays ? String(rule.customIntervalDays) : '',
    nextOccurrenceDate: rule?.nextOccurrenceDate ?? today,
    endsOn: rule?.endsOn ?? '',
  }
}

export function toRecurringRuleInput(values: RecurringRuleFormValues): RecurringRuleInput | null {
  const amountCzk = parsePositiveWholeCzk(values.amountCzk)
  const customIntervalDays = values.frequency === 'custom_days' ? parsePositiveWholeCzk(values.customIntervalDays) : null
  if (amountCzk === null || (values.frequency === 'custom_days' && customIntervalDays === null)) return null

  const base = {
    name: values.name.trim(), kind: values.kind, amountCzk, note: values.note.trim() || null,
    labelIds: values.labelIds, frequency: values.frequency, customIntervalDays,
    nextOccurrenceDate: values.nextOccurrenceDate, endsOn: values.endsOn || null,
  }
  return values.kind === 'transaction'
    ? { ...base, walletId: values.walletId, categoryId: values.categoryId }
    : { ...base, sourceWalletId: values.sourceWalletId, destinationWalletId: values.destinationWalletId }
}

export function validateRecurringRuleForm(values: RecurringRuleFormValues, input: RecurringRuleInput | null, today: string): RecurringRuleFormErrors {
  const errors: RecurringRuleFormErrors = {}
  if (!values.name.trim()) errors.name = 'Zadej název opakování.'
  if (!input) {
    errors.amountCzk = 'Zadej celý počet korun větší než nula.'
    if (values.frequency === 'custom_days') errors.customIntervalDays = 'Zadej počet dní větší než nula.'
  }
  if (!values.nextOccurrenceDate || values.nextOccurrenceDate < today) errors.nextOccurrenceDate = 'Další výskyt musí být dnes nebo v budoucnu.'
  if (values.endsOn && values.endsOn < values.nextOccurrenceDate) errors.endsOn = 'Konec nesmí být před dalším výskytem.'
  if (values.kind === 'transaction') {
    if (!values.walletId) errors.walletId = 'Vyber peněženku.'
    if (!values.categoryId) errors.categoryId = 'Vyber kategorii.'
  } else {
    if (!values.sourceWalletId) errors.sourceWalletId = 'Vyber zdrojovou peněženku.'
    if (!values.destinationWalletId) errors.destinationWalletId = 'Vyber cílovou peněženku.'
    if (values.sourceWalletId && values.sourceWalletId === values.destinationWalletId) errors.destinationWalletId = 'Vyber jinou cílovou peněženku.'
  }
  return errors
}

function parsePositiveWholeCzk(value: string) {
  const normalized = value.replaceAll(' ', '').replaceAll('\u00a0', '')
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}
