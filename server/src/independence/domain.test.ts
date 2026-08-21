import { expect, test } from 'vitest'
import { DomainError } from '../management/domain.js'
import { parseIndependenceSettingsInput, parseIrregularExpenseInput, parseIrregularExpenseUpdateInput } from './domain.js'

const validSettings = {
  withdrawalRatePercent: 4,
  expectedRealReturnPercent: 4,
  inflationRatePercent: 2.5,
  monthlyContributionCzk: 5_000,
  housingMonthlyCzk: 15_000,
  foodMonthlyCzk: 8_000,
  transportMonthlyCzk: 2_000,
  healthMonthlyCzk: 1_500,
  leisureMonthlyCzk: 4_000,
  clothingMonthlyCzk: 1_000,
  familyMonthlyCzk: 0,
  reserveMonthlyCzk: 2_000,
}

test('parses valid independence settings unchanged', () => {
  expect(parseIndependenceSettingsInput(validSettings)).toEqual(validSettings)
})

test('rejects a withdrawal rate outside the sane 0.01-20% range', () => {
  expect(() => parseIndependenceSettingsInput({ ...validSettings, withdrawalRatePercent: 0 })).toThrow(DomainError)
  expect(() => parseIndependenceSettingsInput({ ...validSettings, withdrawalRatePercent: 25 })).toThrow(DomainError)
})

test('rejects a negative category amount', () => {
  expect(() => parseIndependenceSettingsInput({ ...validSettings, housingMonthlyCzk: -1 })).toThrow(DomainError)
})

test('rejects a non-integer category amount', () => {
  expect(() => parseIndependenceSettingsInput({ ...validSettings, foodMonthlyCzk: 1_500.5 })).toThrow(DomainError)
})

test('rejects an unsupported key in the settings payload', () => {
  expect(() => parseIndependenceSettingsInput({ ...validSettings, unexpected: 1 })).toThrow(DomainError)
})

test('parses a valid irregular expense', () => {
  expect(parseIrregularExpenseInput({ name: 'Výměna auta', amountCzk: 400_000, frequencyYears: 8 })).toEqual({
    name: 'Výměna auta',
    amountCzk: 400_000,
    frequencyYears: 8,
  })
})

test('rejects a zero or negative irregular expense amount', () => {
  expect(() => parseIrregularExpenseInput({ name: 'Rekonstrukce', amountCzk: 0, frequencyYears: 15 })).toThrow(DomainError)
  expect(() => parseIrregularExpenseInput({ name: 'Rekonstrukce', amountCzk: -100, frequencyYears: 15 })).toThrow(DomainError)
})

test('rejects a zero or negative frequency', () => {
  expect(() => parseIrregularExpenseInput({ name: 'Rekonstrukce', amountCzk: 100_000, frequencyYears: 0 })).toThrow(DomainError)
  expect(() => parseIrregularExpenseInput({ name: 'Rekonstrukce', amountCzk: 100_000, frequencyYears: -3 })).toThrow(DomainError)
})

test('rejects a blank irregular expense name', () => {
  expect(() => parseIrregularExpenseInput({ name: '   ', amountCzk: 100_000, frequencyYears: 5 })).toThrow(DomainError)
})

test('allows a partial irregular expense update but rejects an empty one', () => {
  expect(parseIrregularExpenseUpdateInput({ amountCzk: 450_000 })).toEqual({ amountCzk: 450_000 })
  expect(() => parseIrregularExpenseUpdateInput({})).toThrow(DomainError)
})
