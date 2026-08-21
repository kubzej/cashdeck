import { asRecord, assertOnlyKeys, DomainError, parseWholeCzk } from '../management/domain.js'

export type IndependenceSettingsInput = {
  withdrawalRatePercent: number
  expectedRealReturnPercent: number
  inflationRatePercent: number
  monthlyContributionCzk: number
  housingMonthlyCzk: number
  foodMonthlyCzk: number
  transportMonthlyCzk: number
  healthMonthlyCzk: number
  leisureMonthlyCzk: number
  clothingMonthlyCzk: number
  familyMonthlyCzk: number
  reserveMonthlyCzk: number
}

export type IrregularExpenseInput = {
  name: string
  amountCzk: number
  frequencyYears: number
}

const settingsKeys = [
  'withdrawalRatePercent', 'expectedRealReturnPercent', 'inflationRatePercent', 'monthlyContributionCzk',
  'housingMonthlyCzk', 'foodMonthlyCzk', 'transportMonthlyCzk', 'healthMonthlyCzk',
  'leisureMonthlyCzk', 'clothingMonthlyCzk', 'familyMonthlyCzk', 'reserveMonthlyCzk',
] as const

export function parseIndependenceSettingsInput(value: unknown): IndependenceSettingsInput {
  const record = asRecord(value)
  assertOnlyKeys(record, settingsKeys)

  return {
    withdrawalRatePercent: parsePercent(record.withdrawalRatePercent, 'Výběrová sazba', 0.01, 20),
    expectedRealReturnPercent: parsePercent(record.expectedRealReturnPercent, 'Očekávaný reálný výnos', 0, 20),
    inflationRatePercent: parsePercent(record.inflationRatePercent, 'Míra inflace', 0, 20),
    monthlyContributionCzk: parseWholeCzk(record.monthlyContributionCzk, 'Plánovaný měsíční vklad', { allowNegative: false }),
    housingMonthlyCzk: parseWholeCzk(record.housingMonthlyCzk, 'Bydlení', { allowNegative: false }),
    foodMonthlyCzk: parseWholeCzk(record.foodMonthlyCzk, 'Jídlo a domácnost', { allowNegative: false }),
    transportMonthlyCzk: parseWholeCzk(record.transportMonthlyCzk, 'Doprava', { allowNegative: false }),
    healthMonthlyCzk: parseWholeCzk(record.healthMonthlyCzk, 'Zdraví a pojištění', { allowNegative: false }),
    leisureMonthlyCzk: parseWholeCzk(record.leisureMonthlyCzk, 'Volný čas a cestování', { allowNegative: false }),
    clothingMonthlyCzk: parseWholeCzk(record.clothingMonthlyCzk, 'Oblečení a osobní věci', { allowNegative: false }),
    familyMonthlyCzk: parseWholeCzk(record.familyMonthlyCzk, 'Rodina', { allowNegative: false }),
    reserveMonthlyCzk: parseWholeCzk(record.reserveMonthlyCzk, 'Rezerva/ostatní', { allowNegative: false }),
  }
}

function parsePercent(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new DomainError(400, `${field} musí být mezi ${min} a ${max} %.`)
  }
  return value
}

export function parseIrregularExpenseInput(value: unknown): IrregularExpenseInput {
  const record = asRecord(value)
  assertOnlyKeys(record, ['name', 'amountCzk', 'frequencyYears'])
  return {
    name: parseIrregularExpenseName(record.name),
    amountCzk: parsePositiveCzk(record.amountCzk),
    frequencyYears: parsePositiveFrequency(record.frequencyYears),
  }
}

export function parseIrregularExpenseUpdateInput(value: unknown): Partial<IrregularExpenseInput> {
  const record = asRecord(value)
  assertOnlyKeys(record, ['name', 'amountCzk', 'frequencyYears'])
  const update: Partial<IrregularExpenseInput> = {}

  if ('name' in record) update.name = parseIrregularExpenseName(record.name)
  if ('amountCzk' in record) update.amountCzk = parsePositiveCzk(record.amountCzk)
  if ('frequencyYears' in record) update.frequencyYears = parsePositiveFrequency(record.frequencyYears)
  if (Object.keys(update).length === 0) throw new DomainError(400, 'Chybí změna položky.')

  return update
}

function parseIrregularExpenseName(value: unknown): string {
  if (typeof value !== 'string') throw new DomainError(400, 'Název musí být text.')
  const trimmed = value.trim()
  if (!trimmed) throw new DomainError(400, 'Zadej název položky.')
  return trimmed
}

function parsePositiveCzk(value: unknown): number {
  const parsed = parseWholeCzk(value, 'Částka', { allowNegative: false })
  if (parsed <= 0) throw new DomainError(400, 'Částka musí být kladné číslo.')
  return parsed
}

function parsePositiveFrequency(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new DomainError(400, 'Frekvence v letech musí být kladné celé číslo.')
  }
  return value
}
