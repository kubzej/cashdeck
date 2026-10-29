import { useState } from 'react'
import { PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'

type SortableListOptions = {
  onStart: () => void
  onError: (error: unknown) => void
}

/** The list with the item `activeId` moved to where `overId` is, or `null` when nothing would change. */
export function moveItem<T extends { id: string }>(items: T[], activeId: string, overId: string) {
  const oldIndex = items.findIndex((item) => item.id === activeId)
  const newIndex = items.findIndex((item) => item.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null

  const reordered = [...items]
  const [moved] = reordered.splice(oldIndex, 1)
  reordered.splice(newIndex, 0, moved)
  return reordered
}

/**
 * Drag-to-reorder shared by the wallet, category and recurring-rule lists. It owns the touch/pointer
 * sensor, works out the new order and tracks the saving state; what is saved and where an error is
 * shown stays with the screen (`persist` and `onError`).
 */
export function useSortableList({ onStart, onError }: SortableListOptions) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [isReordering, setIsReordering] = useState(false)

  async function handleDragEnd<T extends { id: string }>(event: DragEndEvent, items: T[], persist: (reordered: T[]) => Promise<void>) {
    const { active, over } = event
    if (!over) return
    const reordered = moveItem(items, String(active.id), String(over.id))
    if (!reordered) return

    setIsReordering(true)
    onStart()
    try {
      await persist(reordered)
    } catch (error) {
      onError(error)
    } finally {
      setIsReordering(false)
    }
  }

  return { sensors, isReordering, handleDragEnd }
}
