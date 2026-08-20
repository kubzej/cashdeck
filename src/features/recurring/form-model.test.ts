import { describe, expect, test } from 'vitest'
import { initialRecurringRuleFormValues, toRecurringRuleInput, validateRecurringRuleForm, type RecurringRuleFormValues } from './form-model'

const today = '2026-08-20'

function transactionValues(overrides: Partial<RecurringRuleFormValues> = {}): RecurringRuleFormValues {
  return {
    name: ' Nájem ', kind: 'transaction', direction: 'expense', amountCzk: '23 000',
    walletId: 'wallet-1', categoryId: 'category-1', sourceWalletId: '', destinationWalletId: '',
    note: ' Pravidelná platba ', labelIds: ['label-1'], frequency: 'monthly', customIntervalDays: '',
    nextOccurrenceDate: '2026-09-20', endsOn: '', ...overrides,
  }
}

describe('recurring rule form model', () => {
  test('normalizes a transaction rule into its API input', () => {
    expect(toRecurringRuleInput(transactionValues())).toEqual({
      name: 'Nájem', kind: 'transaction', amountCzk: 23000, walletId: 'wallet-1', categoryId: 'category-1',
      note: 'Pravidelná platba', labelIds: ['label-1'], frequency: 'monthly', customIntervalDays: null,
      nextOccurrenceDate: '2026-09-20', endsOn: null,
    })
  })

  test('creates a transfer input without transaction-only fields', () => {
    const values = transactionValues({
      kind: 'transfer', walletId: '', categoryId: '', sourceWalletId: 'wallet-1', destinationWalletId: 'wallet-2',
      frequency: 'custom_days', customIntervalDays: '14', endsOn: '2026-12-20',
    })
    expect(toRecurringRuleInput(values)).toEqual({
      name: 'Nájem', kind: 'transfer', amountCzk: 23000, sourceWalletId: 'wallet-1', destinationWalletId: 'wallet-2',
      note: 'Pravidelná platba', labelIds: ['label-1'], frequency: 'custom_days', customIntervalDays: 14,
      nextOccurrenceDate: '2026-09-20', endsOn: '2026-12-20',
    })
  })

  test('rejects invalid whole-crown values and reports every missing transaction field', () => {
    const values = transactionValues({ name: ' ', amountCzk: '12.5', walletId: '', categoryId: '', frequency: 'custom_days', customIntervalDays: '0' })
    const input = toRecurringRuleInput(values)
    expect(input).toBeNull()
    expect(validateRecurringRuleForm(values, input, today)).toMatchObject({
      name: 'Zadej název opakování.', amountCzk: 'Zadej celý počet korun větší než nula.',
      customIntervalDays: 'Zadej počet dní větší než nula.', walletId: 'Vyber peněženku.', categoryId: 'Vyber kategorii.',
    })
  })

  test('guards calendar dates and transfer wallet selection', () => {
    const values = transactionValues({
      kind: 'transfer', walletId: '', categoryId: '', sourceWalletId: 'wallet-1', destinationWalletId: 'wallet-1',
      nextOccurrenceDate: '2026-08-19', endsOn: '2026-08-18',
    })
    expect(validateRecurringRuleForm(values, toRecurringRuleInput(values), today)).toMatchObject({
      nextOccurrenceDate: 'Další výskyt musí být dnes nebo v budoucnu.',
      endsOn: 'Konec nesmí být před dalším výskytem.',
      destinationWalletId: 'Vyber jinou cílovou peněženku.',
    })
  })

  test('uses today and preserves a stored rule when initializing the form', () => {
    const empty = initialRecurringRuleFormValues(undefined, today)
    expect(empty.nextOccurrenceDate).toBe(today)

    const stored = initialRecurringRuleFormValues({
      id: 'rule-1', name: 'Nájem', kind: 'transaction', amountCzk: 23000,
      walletId: 'wallet-1', walletName: 'Běžný účet', categoryId: 'category-1', categoryName: 'Domov',
      categoryIconKey: 'house', categoryColorKey: 'orange', categoryDirection: 'expense',
      sourceWalletId: null, sourceWalletName: null, destinationWalletId: null, destinationWalletName: null,
      note: 'Poznámka', labels: [{ id: 'label-1', name: 'bydlení' }], frequency: 'monthly',
      customIntervalDays: null, nextOccurrenceDate: '2026-09-20', endsOn: '2026-12-20', status: 'active',
    }, today)
    expect(stored).toMatchObject({ amountCzk: '23000', labelIds: ['label-1'], nextOccurrenceDate: '2026-09-20', endsOn: '2026-12-20' })
  })
})
