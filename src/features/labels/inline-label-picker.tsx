import { useEffect, useState } from 'react'
import { Check, Plus, Search, Tag, X } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Label as FormLabel } from '../../components/ui/label'
import { createLabel, listLabels, type Label } from './api'

type InlineLabelPickerProps = {
  labels: Label[]
  selectedIds: string[]
  onLabelsChange: (labels: Label[]) => void
  onValueChange: (ids: string[]) => void
}

export function InlineLabelPicker({ labels, selectedIds, onLabelsChange, onValueChange }: InlineLabelPickerProps) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Label[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)
  const selectedLabels = labels.filter((label) => selectedIds.includes(label.id))

  useEffect(() => {
    if (!query) {
      setMatches([])
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(() => {
      void listLabels({ query, limit: 8 }).then((page) => {
        if (!cancelled) setMatches(page.items)
      }).catch(() => {
        if (!cancelled) setMatches([])
      })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [query])

  async function createNewLabel() {
    const name = query.trim().toLowerCase()
    if (!name || isCreating) return

    setIsCreating(true)
    setCreationError(null)
    try {
      const label = await createLabel(name)
      onLabelsChange([label, ...labels.filter((item) => item.id !== label.id)].slice(0, 8))
      onValueChange(selectedIds.includes(label.id) ? selectedIds : [...selectedIds, label.id])
      setQuery('')
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'Štítek se nepodařilo vytvořit.')
    } finally {
      setIsCreating(false)
    }
  }

  function toggleLabel(label: Label) {
    if (selectedIds.includes(label.id)) {
      onValueChange(selectedIds.filter((id) => id !== label.id))
    } else {
      onLabelsChange([label, ...labels.filter((item) => item.id !== label.id)].slice(0, 8))
      onValueChange([...selectedIds, label.id])
    }
    setQuery('')
  }

  const canCreate = query.trim().length > 0 && !matches.some((label) => label.name === query.trim())

  return <section className="transaction-labels" aria-label="Štítky">
    <FormLabel>Štítky</FormLabel>
    <div className="transaction-label-search"><Search aria-hidden="true" /><Input value={query} autoCapitalize="none" placeholder="Hledat nebo vytvořit štítek" aria-label="Hledat nebo vytvořit štítek" onChange={(event) => { setCreationError(null); setQuery(event.currentTarget.value.toLowerCase()) }} onKeyDown={(event) => { if (event.key === 'Enter' && canCreate) { event.preventDefault(); void createNewLabel() } }} /></div>
    {query ? <div className="transaction-label-results">
      {matches.map((label) => <button key={label.id} className="transaction-label-result" data-selected={selectedIds.includes(label.id) || undefined} type="button" onClick={() => toggleLabel(label)}><Tag aria-hidden="true" /><span>{label.name}</span>{selectedIds.includes(label.id) ? <Check aria-hidden="true" /> : null}</button>)}
      {canCreate ? <button className="transaction-label-result transaction-label-result--create" type="button" onClick={() => void createNewLabel()} disabled={isCreating}><Plus aria-hidden="true" /><span>{isCreating ? 'Vytvářím štítek' : `Vytvořit „${query.trim()}“`}</span></button> : null}
      {creationError ? <p className="transaction-label-error">{creationError}</p> : null}
    </div> : null}
    {selectedLabels.length > 0 ? <div className="transaction-label-chips">{selectedLabels.map((label) => <button key={label.id} className="transaction-label-chip transaction-label-chip--selected" type="button" onClick={() => toggleLabel(label)}>{label.name}<X aria-hidden="true" /></button>)}</div> : null}
    {labels.some((label) => !selectedIds.includes(label.id)) ? <div className="transaction-label-chips">{labels.filter((label) => !selectedIds.includes(label.id)).map((label) => <button key={label.id} className="transaction-label-chip" type="button" onClick={() => toggleLabel(label)}>{label.name}</button>)}</div> : null}
  </section>
}
