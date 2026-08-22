import { useEffect, useState } from 'react'
import { CircleAlert, Plus, RefreshCw, Search, Tags } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ScreenHeader } from '../../components/screen-header'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Input } from '../../components/ui/input'
import { List, ListItem, ListItemContent, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { SEARCH_DEBOUNCE_MS } from '../../lib/search-debounce'
import { LabelFormScreen } from './label-form-screen'
import { listLabels, type Label } from './api'
import './labels.css'

type LabelsView = 'list' | 'new' | 'edit'

export function LabelsScreen({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<LabelsView>('list')
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null)
  const [query, setQuery] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [labels, setLabels] = useState<Label[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setStatus('loading')
      try {
        const result = await listLabels({ query })
        if (cancelled) return
        setLabels(result.items)
        setNextCursor(result.nextCursor)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }, query ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [query, reloadKey])

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const result = await listLabels({ query, cursor: nextCursor })
      setLabels((current) => [...current, ...result.items])
      setNextCursor(result.nextCursor)
    } finally {
      setIsLoadingMore(false)
    }
  }

  function finishForm() {
    setSelectedLabel(null)
    setView('list')
    setReloadKey((current) => current + 1)
  }

  if (view === 'new') return <LabelFormScreen onCancel={() => setView('list')} onSaved={finishForm} />
  if (view === 'edit' && selectedLabel) return <LabelFormScreen label={selectedLabel} onCancel={() => setView('list')} onSaved={finishForm} onDeleted={finishForm} />

  return (
    <section className="labels-screen" aria-labelledby="labels-title">
      <ScreenHeader
        title="Štítky"
        titleId="labels-title"
        backLabel="Zpět do nastavení"
        onBack={onBack}
        action={<Button variant="ghost" size="icon" aria-label="Přidat štítek" onClick={() => setView('new')}><Plus aria-hidden="true" /></Button>}
      />
      <div className="labels-search">
        <Search aria-hidden="true" />
        <Input value={query} clearable clearLabel="Vymazat hledání" placeholder="Hledat štítky" aria-label="Hledat štítky" onChange={(event) => setQuery(event.currentTarget.value)} onClear={() => setQuery('')} />
      </div>
      <LabelPanel status={status} labels={labels} query={query} onRetry={() => setReloadKey((current) => current + 1)} onSelect={(label) => { setSelectedLabel(label); setView('edit') }} />
      {status === 'ready' && nextCursor ? <Button variant="outline" className="labels-load-more" loading={isLoadingMore} onClick={() => void loadMore()}>Načíst další</Button> : null}
    </section>
  )
}

function LabelPanel({ status, labels, query, onRetry, onSelect }: { status: 'loading' | 'ready' | 'error'; labels: Label[]; query: string; onRetry: () => void; onSelect: (label: Label) => void }) {
  if (status === 'loading') return <div className="labels-loading" aria-label="Načítání štítků"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
  if (status === 'error') return <FeedbackState status="error" layout="panel" className="labels-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Štítky se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
  if (labels.length === 0) return <EmptyState variant="quiet" size="lg" className="labels-empty"><EmptyStateIcon><Tags aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>{query ? 'Žádné odpovídající štítky' : 'Bez štítků'}</EmptyStateTitle><EmptyStateDescription>{query ? 'Zkus upravit hledání.' : 'Vytvoř první štítek pro svoje transakce.'}</EmptyStateDescription></EmptyState>

  return <List gap="sm" className="labels-list" aria-label="Seznam štítků">{labels.map((label) => <ListItem key={label.id} render={<button type="button" onClick={() => onSelect(label)} />} interactive variant="quiet" size="default" className="surface-row labels-row"><Tags className="labels-row-icon" aria-hidden="true" /><ListItemContent><ListItemTitle>{label.name}</ListItemTitle></ListItemContent></ListItem>)}</List>
}
