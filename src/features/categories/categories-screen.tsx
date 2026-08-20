import { useEffect, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, CircleAlert, Plus, RefreshCw, Tags } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '../../components/ui/empty-state'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { List } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { CategoryFormScreen } from './category-form-screen'
import { reorderCategories, listCategories, type Category, type CategoryDirection } from './api'
import { SortableCategoryRow } from './sortable-category-row'
import './categories.css'

type CategoryView = 'list' | 'new' | 'edit'

export function CategoriesScreen({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<CategoryView>('list')
  const [activeDirection, setActiveDirection] = useState<CategoryDirection>('expense')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [categories, setCategories] = useState<Category[]>([])
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function loadCategories() {
    setStatus('loading')
    try {
      const result = await listCategories()
      setCategories(result.items)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void loadCategories()
  }, [])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const visibleCategories = categories.filter((category) => category.direction === activeDirection)
    const oldIndex = visibleCategories.findIndex((category) => category.id === active.id)
    const newIndex = visibleCategories.findIndex((category) => category.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = [...visibleCategories]
    const [movedCategory] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, movedCategory)
    const reorderedWithSortOrder = reordered.map((category, sortOrder) => ({ ...category, sortOrder }))
    setIsReordering(true)
    setReorderError(null)

    try {
      await reorderCategories(activeDirection, reorderedWithSortOrder.map((category) => category.id))
      setCategories((current) => [
        ...current.filter((category) => category.direction !== activeDirection),
        ...reorderedWithSortOrder,
      ])
    } catch (error) {
      setReorderError(error instanceof Error ? error.message : 'Pořadí kategorií se nepodařilo uložit.')
    } finally {
      setIsReordering(false)
    }
  }

  function openEdit(category: Category) {
    setSelectedCategory(category)
    setView('edit')
  }

  function finishForm() {
    setSelectedCategory(null)
    setView('list')
    void loadCategories()
  }

  if (view === 'new') return <CategoryFormScreen direction={activeDirection} onCancel={() => setView('list')} onSaved={finishForm} />
  if (view === 'edit' && selectedCategory) return <CategoryFormScreen category={selectedCategory} direction={selectedCategory.direction} onCancel={() => setView('list')} onSaved={finishForm} onDeleted={finishForm} />

  const expenseCategories = categories.filter((category) => category.direction === 'expense')
  const incomeCategories = categories.filter((category) => category.direction === 'income')

  return (
    <section className="categories-screen" aria-labelledby="categories-title">
      <header className="categories-header">
        <Button variant="ghost" size="icon" aria-label="Zpět do nastavení" onClick={onBack}><ArrowLeft aria-hidden="true" /></Button>
        <h1 id="categories-title">Kategorie</h1>
        <Button variant="ghost" size="icon" aria-label={`Přidat ${activeDirection === 'expense' ? 'výdajovou' : 'příjmovou'} kategorii`} onClick={() => setView('new')}><Plus aria-hidden="true" /></Button>
      </header>
      <Tabs value={activeDirection} onValueChange={(value) => setActiveDirection(value as CategoryDirection)}>
        <TabsList variant="default" className="mx-auto">
          <TabsTrigger value="expense">Výdaje</TabsTrigger>
          <TabsTrigger value="income">Příjmy</TabsTrigger>
        </TabsList>
        <TabsContent value="expense"><CategoryPanel direction="expense" categories={expenseCategories} status={status} reorderError={reorderError} isReordering={isReordering} onRetry={loadCategories} onSelect={openEdit} onDragEnd={handleDragEnd} sensors={sensors} /></TabsContent>
        <TabsContent value="income"><CategoryPanel direction="income" categories={incomeCategories} status={status} reorderError={reorderError} isReordering={isReordering} onRetry={loadCategories} onSelect={openEdit} onDragEnd={handleDragEnd} sensors={sensors} /></TabsContent>
      </Tabs>
    </section>
  )
}

function CategoryPanel({ direction, categories, status, reorderError, isReordering, onRetry, onSelect, onDragEnd, sensors }: { direction: CategoryDirection; categories: Category[]; status: 'loading' | 'ready' | 'error'; reorderError: string | null; isReordering: boolean; onRetry: () => Promise<void>; onSelect: (category: Category) => void; onDragEnd: (event: DragEndEvent) => Promise<void>; sensors: ReturnType<typeof useSensors> }) {
  if (status === 'loading') return <div className="categories-loading" aria-label="Načítání kategorií"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
  if (status === 'error') return <FeedbackState status="error" layout="panel" className="categories-feedback"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Kategorie se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent><FeedbackStateActions><Button variant="outline" onClick={() => void onRetry()}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions></FeedbackState>
  if (categories.length === 0) return <EmptyState variant="quiet" size="lg" className="categories-empty"><EmptyStateIcon><Tags aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>Bez kategorií</EmptyStateTitle><EmptyStateDescription>Vytvoř první kategorii pro tento typ transakcí.</EmptyStateDescription></EmptyState>

  return <section className="categories-list" aria-label={direction === 'expense' ? 'Výdajové kategorie' : 'Příjmové kategorie'}>{reorderError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Pořadí se nepodařilo uložit</FeedbackStateTitle><FeedbackStateDescription>{reorderError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}><SortableContext items={categories.map((category) => category.id)} strategy={verticalListSortingStrategy}><List gap="sm">{categories.map((category) => <SortableCategoryRow key={category.id} category={category} disabled={isReordering} onSelect={onSelect} />)}</List></SortableContext></DndContext></section>
}
