import { type CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical, WalletCards } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ListItem, ListItemActions, ListItemContent, ListItemTitle } from '../../components/ui/list'
import { type Wallet } from './api'

export function SortableWalletRow({ wallet, disabled, onSelect }: { wallet: Wallet; disabled: boolean; onSelect: (wallet: Wallet) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: wallet.id, disabled })
  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.45 : undefined,
  }

  return (
    <ListItem render={<div ref={setNodeRef} style={style} />} role="listitem" variant="quiet" size="spacious" className="wallet-row" interactive onClick={() => onSelect(wallet)}>
      <WalletCards className={`wallet-icon wallet-icon--${wallet.colorKey}`} aria-hidden="true" />
      <ListItemContent className="wallet-row__content">
        <ListItemTitle className="wallet-name">{wallet.name}</ListItemTitle>
      </ListItemContent>
      <ListItemActions>
        <span className="wallet-balance">{formatCzk(wallet.openingBalanceCzk)}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Změnit pořadí peněženky ${wallet.name}`}
          disabled={disabled}
          ref={setActivatorNodeRef}
          className="wallet-drag-handle"
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

function formatCzk(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', maximumFractionDigits: 0,
  }).format(value)
}
