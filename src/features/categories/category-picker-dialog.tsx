import { useState } from 'react'
import { Check, Tag } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { CategoryIcon } from './category-icon'
import type { Category } from './api'

/** Button that opens a grid of categories; used by the transaction and recurring-rule forms. */
export function CategoryPickerDialog({ categories, selectedCategory, onSelect }: { categories: Category[]; selectedCategory: Category | null; onSelect: (categoryId: string) => void }) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" className="transaction-picker-button" data-selected={selectedCategory ? '' : undefined} />}>
      {selectedCategory ? <><CategoryIcon iconKey={selectedCategory.iconKey} colorKey={selectedCategory.colorKey} /><span>{selectedCategory.name}</span></> : <><Tag aria-hidden="true" /><span>Vyber kategorii</span></>}
    </DialogTrigger>
    <DialogContent size="default" className="transaction-picker-dialog">
      <DialogHeader><DialogTitle>Vyber kategorii</DialogTitle></DialogHeader>
      <DialogBody><div className="transaction-category-grid">
        {categories.map((category) => <button key={category.id} className={`transaction-category-option color-key--${category.colorKey}`} data-selected={selectedCategory?.id === category.id || undefined} type="button" onClick={() => { onSelect(category.id); setOpen(false) }}><CategoryIcon iconKey={category.iconKey} colorKey={category.colorKey} /><span>{category.name}</span>{selectedCategory?.id === category.id ? <Check aria-hidden="true" /> : null}</button>)}
      </div></DialogBody>
    </DialogContent>
  </Dialog>
}
