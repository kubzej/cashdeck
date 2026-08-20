import { useState, type FormEvent } from 'react'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ColorPicker } from '../../components/color-picker'
import { DeleteConfirmationDialog } from '../../components/delete-confirmation-dialog'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Field, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { CategoryIconPreview, categoryIconLabel } from './category-icon'
import { categoryIconKeys, createCategory, deleteCategory, updateCategory, type Category, type CategoryColorKey, type CategoryDirection, type CategoryIconKey } from './api'
import './categories.css'

type CategoryFormValues = {
  name: string
  colorKey: CategoryColorKey
  iconKey: CategoryIconKey
}

export function CategoryFormScreen({ category, direction, onCancel, onSaved, onDeleted }: { category?: Category; direction: CategoryDirection; onCancel: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [values, setValues] = useState<CategoryFormValues>({
    name: category?.name ?? '',
    colorKey: category?.colorKey ?? 'teal',
    iconKey: category?.iconKey ?? 'tags',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormValues, string>>>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof CategoryFormValues, string>> = {}
    if (!values.name.trim()) nextErrors.name = 'Zadej název kategorie.'
    setErrors(nextErrors)
    setSubmissionError(null)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const input = { name: values.name.trim(), colorKey: values.colorKey, iconKey: values.iconKey }
      if (category) await updateCategory(category.id, input)
      else await createCategory({ ...input, direction })
      onSaved()
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Kategorii se nepodařilo uložit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!category || !onDeleted) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteCategory(category.id)
      onDeleted()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Kategorii se nepodařilo smazat.')
    } finally {
      setIsDeleting(false)
    }
  }

  const title = category ? 'Upravit kategorii' : `Nová ${direction === 'expense' ? 'výdajová' : 'příjmová'} kategorie`

  return (
    <section className="category-form-screen" aria-labelledby="category-form-title">
      <header className="category-form-header">
        <Button variant="ghost" size="icon" aria-label="Zpět na kategorie" onClick={onCancel}><ArrowLeft aria-hidden="true" /></Button>
        <h1 id="category-form-title">{title}</h1>
        {category ? <DeleteConfirmationDialog title="Smazat kategorii?" description={`Kategorie „${category.name}“ bude trvale smazána.`} triggerLabel="Smazat kategorii" isDeleting={isDeleting} onConfirm={() => void handleDelete()} /> : <span aria-hidden="true" />}
      </header>
      <form className="category-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {submissionError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Kategorii se nepodařilo uložit</FeedbackStateTitle><FeedbackStateDescription>{submissionError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
        <Field invalid={Boolean(errors.name)}>
          <FieldLabel>Název</FieldLabel>
          <Input autoFocus value={values.name} placeholder="Např. Bydlení" onChange={(event) => { const name = event.currentTarget.value; setValues((current) => ({ ...current, name })) }} />
          <FieldError match={Boolean(errors.name)}>{errors.name}</FieldError>
        </Field>
        <fieldset className="category-picker-field">
          <legend>Ikona</legend>
          <ToggleGroup type="single" value={values.iconKey} variant="ghost" size="icon" aria-label="Ikona kategorie" className="category-icon-grid" onValueChange={(iconKey) => { if (iconKey) setValues((current) => ({ ...current, iconKey: iconKey as CategoryIconKey })) }}>
            {categoryIconKeys.map((iconKey) => <ToggleGroupItem key={iconKey} aria-label={categoryIconLabel(iconKey)} className="category-icon-choice" value={iconKey}><CategoryIconPreview iconKey={iconKey} /></ToggleGroupItem>)}
          </ToggleGroup>
        </fieldset>
        <fieldset className="category-picker-field">
          <legend>Barva</legend>
          <ColorPicker value={values.colorKey} ariaLabel="Barva kategorie" onValueChange={(colorKey) => setValues((current) => ({ ...current, colorKey: colorKey as CategoryColorKey }))} />
        </fieldset>
        <Button type="submit" size="lg" className="category-form-submit" loading={isSubmitting}>{category ? 'Uložit změny' : 'Uložit kategorii'}</Button>
        {category && deleteError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Kategorii se nepodařilo smazat</FeedbackStateTitle><FeedbackStateDescription>{deleteError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
      </form>
    </section>
  )
}
