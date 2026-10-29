import { useEffect, useMemo, useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown, ChevronUp, CircleAlert, Pencil, Plus, WalletCards } from 'lucide-react'
import { LoadError } from '../../components/load-error'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List, ListItem, ListItemActions, ListItemContent, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { formatCzk } from '../../lib/format-czk'
import { useSortableList } from '../../lib/sortable-list'
import { listWallets, reorderWallets, updateWallet, type Wallet } from './api'
import { SortableWalletRow } from './sortable-wallet-row'
import { WalletTypeIcon } from './wallet-type-icon'
import './wallets.css'

export function WalletsScreen({ onCreate, onSelect, onManage }: { onCreate: () => void; onSelect: (wallet: Wallet) => void; onManage: (wallet: Wallet) => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [unhidingId, setUnhidingId] = useState<string | null>(null)
  const { sensors, isReordering, handleDragEnd: reorderByDrag } = useSortableList({
    onStart: () => setActionError(null),
    onError: (error) => setActionError({ title: 'Pořadí se nepodařilo uložit', message: error instanceof Error ? error.message : 'Pořadí peněženek se nepodařilo uložit.' }),
  })

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
    setActionError(null)
    try {
      await updateWallet(wallet.id, { isHidden: false })
      await loadWallets()
    } catch (error) {
      setActionError({ title: 'Peněženku se nepodařilo zobrazit', message: error instanceof Error ? error.message : 'Zkus to prosím znovu.' })
    } finally {
      setUnhidingId(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    await reorderByDrag(event, visibleWallets, async (nextVisible) => {
      // reorderWallets requires the complete id set (visible + hidden); hidden wallets are
      // appended after the visible ones since their relative order isn't shown anywhere.
      const nextWallets = [...nextVisible, ...hiddenWallets]
      await reorderWallets(nextWallets.map((wallet) => wallet.id))
      setWallets(nextWallets)
    })
  }

  if (status === 'loading') {
    return <div className="wallets-loading" aria-label="Načítání peněženek"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
  }

  if (status === 'error') {
    return (
      <LoadError title="Peněženky se nepodařilo načíst" className="wallets-feedback" onRetry={() => void loadWallets()} />
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
      {actionError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>{actionError.title}</FeedbackStateTitle><FeedbackStateDescription>{actionError.message}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
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
