import { expect, test } from 'vitest'
import { moveItem } from './sortable-list'

const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (list: Array<{ id: string }> | null) => list?.map((item) => item.id)

test('moves an item down and up to the position of the one it was dropped on', () => {
  expect(ids(moveItem(items, 'a', 'c'))).toEqual(['b', 'c', 'a', 'd'])
  expect(ids(moveItem(items, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c'])
})

test('does not touch the original list', () => {
  moveItem(items, 'a', 'd')
  expect(ids(items)).toEqual(['a', 'b', 'c', 'd'])
})

test('returns null when nothing changes or an id is not in the list', () => {
  expect(moveItem(items, 'b', 'b')).toBeNull()
  expect(moveItem(items, 'x', 'b')).toBeNull()
  expect(moveItem(items, 'b', 'x')).toBeNull()
})
