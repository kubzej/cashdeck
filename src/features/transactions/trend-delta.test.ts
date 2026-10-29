import { expect, test } from 'vitest'
import { getTrendDelta } from './trend-delta'

test('no previous-period activity gives no percentage, only a neutral note', () => {
  expect(getTrendDelta(5000, 0)).toEqual({ tone: 'neutral', label: 'bez srovnání' })
  expect(getTrendDelta(0, 0)).toEqual({ tone: 'neutral', label: 'beze změny' })
})

test('an unchanged total is neutral', () => {
  expect(getTrendDelta(1200, 1200)).toEqual({ tone: 'neutral', label: 'beze změny' })
})

test('growth and decline are shown as a rounded percentage of the previous period', () => {
  expect(getTrendDelta(1500, 1000)).toEqual({ tone: 'positive', label: '+50 %' })
  expect(getTrendDelta(500, 1000)).toEqual({ tone: 'negative', label: '-50 %' })
  expect(getTrendDelta(1001, 3000)).toEqual({ tone: 'negative', label: '-67 %' })
})

test('a negative previous total is compared by its size', () => {
  expect(getTrendDelta(-500, -1000)).toEqual({ tone: 'positive', label: '+50 %' })
  expect(getTrendDelta(-1500, -1000)).toEqual({ tone: 'negative', label: '-50 %' })
})
