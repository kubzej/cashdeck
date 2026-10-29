import { expect, test } from 'vitest'
import { MAX_AMOUNT_CZK } from '../../server/src/catalog'
import { AMOUNT_TOO_LARGE_ERROR, amountErrorMessage, applyAmountInput, DECIMAL_INPUT_ERROR, MAX_SCENARIO_PERCENT, parseDecimalInput, parseNonNegativeCzk, parseNonNegativeInteger, parsePercentInput, parsePositiveInteger, parsePositiveWholeCzk, parseScenarioPercent, parseSignedWholeCzk, resolveField, SIGN_INPUT_ERROR } from './amount-input'

test('pasted text with a decimal separator is rejected as a whole, never turned into a different amount', () => {
  expect(applyAmountInput('99,90', '12')).toEqual({ value: '12', error: DECIMAL_INPUT_ERROR })
  expect(applyAmountInput('1 000,50', '')).toEqual({ value: '', error: DECIMAL_INPUT_ERROR })
  expect(applyAmountInput('12.5', '7')).toEqual({ value: '7', error: DECIMAL_INPUT_ERROR })
})

test('a pasted sign is rejected instead of silently dropped', () => {
  expect(applyAmountInput('-500', '3')).toEqual({ value: '3', error: SIGN_INPUT_ERROR })
  expect(applyAmountInput('+500', '')).toEqual({ value: '', error: SIGN_INPUT_ERROR })
  expect(applyAmountInput('−500', '')).toEqual({ value: '', error: SIGN_INPUT_ERROR })
})

test('Czech "1 500,-" means whole crowns and is accepted', () => {
  expect(applyAmountInput('1 500,-', '')).toEqual({ value: '1 500', error: undefined })
  expect(applyAmountInput('99,–', '')).toEqual({ value: '99', error: undefined })
})

test('digits and spaces pass, other symbols such as currency are dropped', () => {
  expect(applyAmountInput('1 500 Kč', '')).toEqual({ value: '1 500 ', error: undefined })
  expect(applyAmountInput('abc123', '')).toEqual({ value: '123', error: undefined })
  expect(applyAmountInput('', '5')).toEqual({ value: '', error: undefined })
})

test('parses a positive whole amount within the cap', () => {
  expect(parsePositiveWholeCzk('23 000')).toBe(23000)
  expect(parsePositiveWholeCzk('0')).toBeNull()
  expect(parsePositiveWholeCzk('')).toBeNull()
  expect(parsePositiveWholeCzk('12.5')).toBeNull()
  expect(parsePositiveWholeCzk(String(MAX_AMOUNT_CZK))).toBe(MAX_AMOUNT_CZK)
  expect(parsePositiveWholeCzk(String(MAX_AMOUNT_CZK + 1))).toBeNull()
})

test('the error message says "too large" only for a too-large number', () => {
  expect(amountErrorMessage('10 000 000 001')).toBe(AMOUNT_TOO_LARGE_ERROR)
  expect(amountErrorMessage('99999999999999999999999')).toBe(AMOUNT_TOO_LARGE_ERROR)
  expect(amountErrorMessage('')).toBe('Zadej celý počet korun větší než nula.')
  expect(amountErrorMessage('0')).toBe('Zadej celý počet korun větší než nula.')
  expect(amountErrorMessage('12.5')).toBe('Zadej celý počet korun větší než nula.')
})

test('a non-negative amount field treats empty as 0 and rejects anything but whole numbers', () => {
  expect(parseNonNegativeCzk('')).toBe(0)
  expect(parseNonNegativeCzk('   ')).toBe(0)
  expect(parseNonNegativeCzk('12 500')).toBe(12500)
  expect(parseNonNegativeCzk('12.5')).toBeNull()
  expect(parseNonNegativeCzk('-5')).toBeNull()
  expect(parseNonNegativeCzk('abc')).toBeNull()
})

test('a signed whole amount allows a minus sign, spaces and non-breaking spaces', () => {
  expect(parseSignedWholeCzk('-1 500')).toBe(-1500)
  expect(parseSignedWholeCzk('1 500')).toBe(1500)
  expect(parseSignedWholeCzk('0')).toBe(0)
  expect(parseSignedWholeCzk('')).toBeNull()
  expect(parseSignedWholeCzk('1,5')).toBeNull()
  expect(parseSignedWholeCzk('--5')).toBeNull()
})

test('a percentage accepts a comma or a point, and the range decides whether a negative one is allowed', () => {
  expect(parsePercentInput('4,5', 0, 20)).toBe(4.5)
  expect(parsePercentInput(' 4.5 ', 0, 20)).toBe(4.5)
  expect(parsePercentInput('-3', -10, 20)).toBe(-3)
  expect(parsePercentInput('-3', 0, 20)).toBeNull()
  expect(parsePercentInput('21', 0, 20)).toBeNull()
  expect(parsePercentInput('0', 0.01, 20)).toBeNull()
  expect(parsePercentInput('abc', 0, 20)).toBeNull()
})

test('a decimal number accepts a comma or a point and nothing else', () => {
  expect(parseDecimalInput('4,5')).toBe(4.5)
  expect(parseDecimalInput(' -3.25 ')).toBe(-3.25)
  expect(parseDecimalInput('7')).toBe(7)
  expect(parseDecimalInput('')).toBeNull()
  expect(parseDecimalInput('1e3')).toBeNull()
  expect(parseDecimalInput('4,5,6')).toBeNull()
  expect(parseDecimalInput('abc')).toBeNull()
})

test('whole-number fields: positive needs more than zero, non-negative treats empty as zero', () => {
  expect(parsePositiveInteger('45')).toBe(45)
  expect(parsePositiveInteger('0')).toBeNull()
  expect(parsePositiveInteger('4.5')).toBeNull()
  expect(parseNonNegativeInteger('')).toBe(0)
  expect(parseNonNegativeInteger('12')).toBe(12)
  expect(parseNonNegativeInteger('-1')).toBeNull()
})

test('a what-if percentage is any number the maths can take, with only a loose ceiling', () => {
  // A return must stay above -100 %; the 20 % ceiling of the saved settings does not apply.
  expect(parseScenarioPercent('25', { above: -100 })).toBe(25)
  expect(parseScenarioPercent('-99,5', { above: -100 })).toBe(-99.5)
  expect(parseScenarioPercent('-100', { above: -100 })).toBeNull()
  expect(parseScenarioPercent('-150', { above: -100 })).toBeNull()
  // A withdrawal rate must stay above 0, but a tiny one is fine.
  expect(parseScenarioPercent('0,001', { above: 0 })).toBe(0.001)
  expect(parseScenarioPercent('0', { above: 0 })).toBeNull()
  // Expenses may drop by exactly 100 %, not further.
  expect(parseScenarioPercent('-100', { atLeast: -100 })).toBe(-100)
  expect(parseScenarioPercent('-101', { atLeast: -100 })).toBeNull()
  // The ceiling only guards against overflow.
  expect(parseScenarioPercent(String(MAX_SCENARIO_PERCENT), { above: -100 })).toBe(MAX_SCENARIO_PERCENT)
  expect(parseScenarioPercent('60000000000', { above: -100 })).toBeNull()
  expect(parseScenarioPercent('abc', { above: -100 })).toBeNull()
})

test('an unusable field keeps its fallback and reports an error only if something was typed', () => {
  expect(resolveField('25', 25, 4, 'chyba')).toEqual({ value: 25, error: undefined })
  expect(resolveField('abc', null, 4, 'chyba')).toEqual({ value: 4, error: 'chyba' })
  expect(resolveField('   ', null, 4, 'chyba')).toEqual({ value: 4, error: undefined })
  expect(resolveField('', null, 4, 'chyba')).toEqual({ value: 4, error: undefined })
})
