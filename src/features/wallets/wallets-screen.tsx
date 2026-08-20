import { useEffect, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CircleAlert, Plus, RefreshCw, WalletCards } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { listWallets, reorderWallets, type Wallet } from './api'
import { SortableWalletRow } from './sortable-wallet-row'
import './wallets.css'

export function WalletsScreen({ onCreate }: { onCreate: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function loadWallets() {
    setStatus('loading')
    try {
      const result = await listWallets()
      setWallets(result.items)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void loadWallets()
  }, [])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = wallets.findIndex((wallet) => wallet.id === active.id)
    const newIndex = wallets.findIndex((wallet) => wallet.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const nextWallets = [...wallets]
    const [movedWallet] = nextWallets.splice(oldIndex, 1)
    nextWallets.splice(newIndex, 0, movedWallet)
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <SortableContext items={wallets.map((wallet) => wallet.id)} strategy={verticalListSortingStrategy}>
          <List gap="sm">{wallets.map((wallet) => <SortableWalletRow key={wallet.id} wallet={wallet} disabled={isReordering} />)}</List>
        </SortableContext>
      </DndContext>
    </section>
  )
}
