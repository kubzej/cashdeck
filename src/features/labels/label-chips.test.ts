import { expect, test } from 'vitest'
import { limitSuggestedLabels, mergeLabels } from './label-chips'

const labels = (count: number, prefix = 'l') => Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index + 1}`, name: `${prefix}${index + 1}` }))

test('keeps every selected label and caps only the unselected suggestions at eight', () => {
  const all = labels(12)
  const selectedIds = ['l1', 'l5', 'l12']

  const result = limitSuggestedLabels(all, selectedIds)

  expect(result.filter((label) => selectedIds.includes(label.id)).map((label) => label.id)).toEqual(['l1', 'l5', 'l12'])
  expect(result.filter((label) => !selectedIds.includes(label.id))).toHaveLength(8)
})

test('selecting a ninth label does not push an already selected one out of sight', () => {
  const selectedIds = labels(8).map((label) => label.id)
  const withNinth = [{ id: 'new', name: 'new' }, ...labels(8)]

  const result = limitSuggestedLabels(withNinth, [...selectedIds, 'new'])

  expect(result.map((label) => label.id)).toEqual(['new', ...selectedIds])
})

test('a record with more than eight labels shows all of them as selected on open', () => {
  const own = labels(10, 'own')
  const recent = labels(8, 'recent')

  const result = mergeLabels(own, recent)

  expect(result.slice(0, 10)).toEqual(own)
  expect(result.slice(10).map((label) => label.id)).toEqual(recent.map((label) => label.id))
})

test('a label that is both on the record and recent appears once', () => {
  const result = mergeLabels([{ id: 'a', name: 'a' }], [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }])

  expect(result.map((label) => label.id)).toEqual(['a', 'b'])
})
