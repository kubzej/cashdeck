import { useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown, ChevronUp, CircleAlert, Pencil, Plus, RefreshCw, WalletCards } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { formatCzk } from '../../lib/format-czk'
import { listWallets, reorderWallets, updateWallet, type Wallet } from './api'
import { SortableWalletRow } from './sortable-wallet-row'
import { WalletTypeIcon } from './wallet-type-icon'
import './wallets.css'

export function WalletsScreen({ onCreate, onSelect, onManage }: { onCreate: () => void; onSelect: (wallet: Wallet) => void; onManage: (wallet: Wallet) => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [unhidingId, setUnhidingId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const visibleWallets = useMemo(() => wallets.filter((wallet) => !wallet.isHidden), [wallets])
  const hiddenWallets = useMemo(() => wallets.filter((wallet) => wallet.isHidden), [wallets])

  async function loadWallets() {
    setStatus('loading')
    try {
      const result = await listWallets({ includeHidden: true })
      setWallets(result.items)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void loadWallets()
  }, [])

  async function handleUnhide(wallet: Wallet) {
    setUnhidingId(wallet.id)
    try {
      await updateWallet(wallet.id, { isHidden: false })
      await loadWallets()
    } finally {
      setUnhidingId(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = visibleWallets.findIndex((wallet) => wallet.id === active.id)
    const newIndex = visibleWallets.findIndex((wallet) => wallet.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const nextVisible = [...visibleWallets]
    const [movedWallet] = nextVisible.splice(oldIndex, 1)
    nextVisible.splice(newIndex, 0, movedWallet)
    // reorderWallets requires the complete id set (visible + hidden); hidden wallets are
    // appended after the visible ones since their relative order isn't shown anywhere.
    const nextWallets = [...nextVisible, ...hiddenWallets]
    setIsReordering(true)
    setReorderError(null)

    try {
      await reorderWallets(nextWallets.map((wallet) => wallet.id))
      setWallets(nextWallets)
    } catch (error) {
      setReorderError(error instanceof Error ? error.message : 'Pořadí peněženek se nepodařilo uložit.')
    } finally {
      setIsReordering(false)
    }
  }

  if (status === 'loading') {
    return <div className="wallets-loading" aria-label="Načítání peněženek"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
  }

  if (status === 'error') {
    return (
      <FeedbackState status="error" layout="panel" className="wallets-feedback">
        <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
        <FeedbackStateContent><FeedbackStateTitle>Peněženky se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent>
        <FeedbackStateActions><Button variant="outline" onClick={() => void loadWallets()}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions>
      </FeedbackState>
    )
  }

  if (wallets.length === 0) {
    return (
      <EmptyState variant="quiet" size="lg" className="screen-placeholder">
        <EmptyStateIcon><WalletCards aria-hidden="true" /></EmptyStateIcon>
        <EmptyStateTitle>Zatím bez peněženek</EmptyStateTitle>
        <EmptyStateDescription>Přidej první peněženku.</EmptyStateDescription>
        <EmptyStateActions><Button onClick={onCreate}><Plus aria-hidden="true" />Přidat peněženku</Button></EmptyStateActions>
      </EmptyState>
    )
  }

  return (
    <section className="wallets-screen" aria-label="Peněženky">
      {reorderError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Pořadí se nepodařilo uložit</FeedbackStateTitle><FeedbackStateDescription>{reorderError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
      {visibleWallets.length > 0 ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <SortableContext items={visibleWallets.map((wallet) => wallet.id)} strategy={verticalListSortingStrategy}>
          <List gap="sm">{visibleWallets.map((wallet) => <SortableWalletRow key={wallet.id} wallet={wallet} disabled={isReordering} onSelect={onSelect} onManage={onManage} onAdjusted={() => void loadWallets()} />)}</List>
        </SortableContext>
      </DndContext> : null}
      {hiddenWallets.length > 0 ? <div className="wallets-hidden-section">
        <Button variant="ghost" className="wallets-hidden-toggle" onClick={() => setShowHidden((current) => !current)} aria-expanded={showHidden}>
          {showHidden ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          <span>Skryté peněženky ({hiddenWallets.length})</span>
        </Button>
        {showHidden ? <List gap="sm">{hiddenWallets.map((wallet) => <ListItem key={wallet.id} variant="quiet" size="spacious" className="wallet-row wallet-row--hidden surface-row">
          <WalletTypeIcon walletType={wallet.walletType} className={`wallet-icon color-key--${wallet.colorKey}`} />
          <ListItemContent className="wallet-row__content">
            <ListItemTitle className="wallet-name">{wallet.name}</ListItemTitle>
            <span className="wallet-balance">{formatCzk(wallet.currentBalanceCzk ?? wallet.openingBalanceCzk)}</span>
          </ListItemContent>
          <ListItemActions>
            <Button variant="ghost" size="icon" aria-label={`Spravovat peněženku ${wallet.name}`} onClick={() => onManage(wallet)}>
              <Pencil aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" loading={unhidingId === wallet.id} onClick={() => void handleUnhide(wallet)}>Zobrazit</Button>
          </ListItemActions>
        </ListItem>)}</List> : null}
      </div> : null}
    </section>
  )
}
