import { useState, type CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical, Pencil, Scale, WalletCards } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ListItem, ListItemActions, ListItemContent, ListItemTitle } from '../../components/ui/list'
import { type Wallet } from './api'
import { BalanceAdjustmentDialog } from './balance-adjustment-dialog'

export function SortableWalletRow({ wallet, disabled, onSelect, onManage, onAdjusted }: { wallet: Wallet; disabled: boolean; onSelect: (wallet: Wallet) => void; onManage: (wallet: Wallet) => void; onAdjusted: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: wallet.id, disabled })
  const [isAdjusting, setIsAdjusting] = useState(false)
  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.45 : undefined,
  }

  return (
    <ListItem render={<div ref={setNodeRef} style={style} />} role="listitem" variant="quiet" size="spacious" className="wallet-row surface-row" interactive onClick={() => onSelect(wallet)}>
      <WalletCards className={`wallet-icon color-key--${wallet.colorKey}`} aria-hidden="true" />
      <ListItemContent className="wallet-row__content">
        <ListItemTitle className="wallet-name">{wallet.name}</ListItemTitle>
        <span className="wallet-balance">{formatCzk(wallet.currentBalanceCzk ?? wallet.openingBalanceCzk)}</span>
      </ListItemContent>
      <ListItemActions>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Vyrovnat zůstatek peněženky ${wallet.name}`}
          title={`Vyrovnat zůstatek peněženky ${wallet.name}`}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation()
            setIsAdjusting(true)
          }}
        >
          <Scale aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Spravovat peněženku ${wallet.name}`}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation()
            onManage(wallet)
          }}
        >
          <Pencil aria-hidden="true" />
        </Button>
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
      {isAdjusting ? <BalanceAdjustmentDialog wallet={wallet} onOpenChange={setIsAdjusting} onAdjusted={onAdjusted} /> : null}
    </ListItem>
  )
}

function formatCzk(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', maximumFractionDigits: 0,
  }).format(value)
}
