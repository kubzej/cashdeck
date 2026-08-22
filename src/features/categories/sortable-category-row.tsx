import { type CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ListItem, ListItemActions, ListItemContent, ListItemTitle } from '../../components/ui/list'
import { CategoryIcon } from './category-icon'
import type { Category } from './api'

export function SortableCategoryRow({ category, disabled, onSelect }: { category: Category; disabled: boolean; onSelect: (category: Category) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: category.id, disabled })
  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.45 : undefined,
  }

  return (
    <ListItem render={<div ref={setNodeRef} style={style} />} role="listitem" variant="quiet" size="compact" className="category-row surface-row" interactive onClick={() => onSelect(category)}>
      <CategoryIcon iconKey={category.iconKey} colorKey={category.colorKey} />
      <ListItemContent className="category-row__content">
        <ListItemTitle className="category-name">{category.name}</ListItemTitle>
      </ListItemContent>
      <ListItemActions>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Změnit pořadí kategorie ${category.name}`}
          disabled={disabled}
          ref={setActivatorNodeRef}
          className="category-drag-handle"
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" />
        </Button>
      </ListItemActions>
    </ListItem>
  )
}
