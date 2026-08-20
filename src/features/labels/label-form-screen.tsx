import { useState, type FormEvent } from 'react'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { DeleteConfirmationDialog } from '../../components/delete-confirmation-dialog'
import { Button } from '../../components/ui/button'
import { FeedbackState, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Field, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { createLabel, deleteLabel, updateLabel, type Label } from './api'
import './labels.css'

export function LabelFormScreen({ label, onCancel, onSaved, onDeleted }: { label?: Label; onCancel: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [name, setName] = useState(label?.name ?? '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim().toLocaleLowerCase('cs-CZ')
    if (!normalizedName) {
      setNameError('Zadej název štítku.')
      return
    }

    setNameError(null)
    setSubmissionError(null)
    setIsSubmitting(true)
    try {
      if (label) await updateLabel(label.id, normalizedName)
      else await createLabel(normalizedName)
      onSaved()
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Štítek se nepodařilo uložit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!label || !onDeleted) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteLabel(label.id)
      onDeleted()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Štítek se nepodařilo smazat.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="label-form-screen" aria-labelledby="label-form-title">
      <header className="label-form-header">
        <Button variant="ghost" size="icon" aria-label="Zpět na štítky" onClick={onCancel}><ArrowLeft aria-hidden="true" /></Button>
        <h1 id="label-form-title">{label ? 'Upravit štítek' : 'Nový štítek'}</h1>
        {label ? <DeleteConfirmationDialog title="Smazat štítek?" description={`Štítek „${label.name}“ bude trvale smazán.`} triggerLabel="Smazat štítek" isDeleting={isDeleting} onConfirm={() => void handleDelete()} /> : <span aria-hidden="true" />}
      </header>
      <form className="label-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {submissionError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Štítek se nepodařilo uložit</FeedbackStateTitle><FeedbackStateDescription>{submissionError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
        <Field invalid={Boolean(nameError)}>
          <FieldLabel>Název</FieldLabel>
          <Input autoFocus value={name} autoCapitalize="none" autoCorrect="off" placeholder="Např. globus" onChange={(event) => { const nextName = event.currentTarget.value.toLocaleLowerCase('cs-CZ'); setName(nextName); setNameError(null) }} />
          <FieldError match={Boolean(nameError)}>{nameError}</FieldError>
        </Field>
        <Button type="submit" size="lg" className="label-form-submit" loading={isSubmitting}>{label ? 'Uložit změny' : 'Uložit štítek'}</Button>
        {label && deleteError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Štítek se nepodařilo smazat</FeedbackStateTitle><FeedbackStateDescription>{deleteError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
      </form>
    </section>
  )
}
