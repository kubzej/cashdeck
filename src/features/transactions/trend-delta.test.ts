import { expect, test } from 'vitest'
import { formatCzk } from '../../lib/format-czk'
import { getTrendDelta } from './trend-delta'

test('no previous-period activity gives no percentage, only a neutral note', () => {
  expect(getTrendDelta(5000, 0)).toEqual({ tone: 'neutral', label: 'bez srovnání', comparable: false })
  expect(getTrendDelta(0, 0)).toEqual({ tone: 'neutral', label: 'beze změny', comparable: false })
})

test('an unchanged total is neutral', () => {
  expect(getTrendDelta(1200, 1200)).toEqual({ tone: 'neutral', label: 'beze změny', comparable: false })
})

test('a change is shown as the difference in crowns against the previous period', () => {
  expect(getTrendDelta(1500, 1000)).toEqual({ tone: 'positive', label: formatCzk(500, { signed: true }), comparable: true })
  expect(getTrendDelta(500, 1000)).toEqual({ tone: 'negative', label: formatCzk(-500, { signed: true }), comparable: true })
})

test('a smaller loss than before counts as an improvement', () => {
  expect(getTrendDelta(-500, -1000)).toEqual({ tone: 'positive', label: formatCzk(500, { signed: true }), comparable: true })
  expect(getTrendDelta(-1500, -1000)).toEqual({ tone: 'negative', label: formatCzk(-500, { signed: true }), comparable: true })
})
