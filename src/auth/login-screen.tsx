import { useState, type FormEvent } from 'react'
import { CircleAlert, LockKeyhole } from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  FeedbackState,
  FeedbackStateContent,
  FeedbackStateDescription,
  FeedbackStateIcon,
  FeedbackStateTitle,
} from '../components/ui/feedback-state'
import { Field, FieldLabel } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { useAuth } from './auth-context'

export function LoginScreen() {
  const { unlock } = useAuth()
  const [passphrase, setPassphrase] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (!passphrase) {
      setErrorMessage('Zadej heslo.')
      return
    }

    setIsSubmitting(true)
    const error = await unlock(passphrase)
    setErrorMessage(error)
    setIsSubmitting(false)
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand-lockup">
          <img src="/cashdeck-mark.svg" alt="" className="auth-brand-mark" />
          <h1 id="login-title" className="brand-name">Cashdeck</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field invalid={Boolean(errorMessage)}>
            <FieldLabel>Heslo</FieldLabel>
            <div className="auth-input-wrap">
              <LockKeyhole aria-hidden="true" />
              <Input
                type="password"
                name="passphrase"
                autoComplete="current-password"
                placeholder="Tvoje heslo"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                disabled={isSubmitting}
                required
                autoFocus
              />
            </div>
          </Field>

          {errorMessage ? (
            <FeedbackState status="error" layout="inline">
              <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
              <FeedbackStateContent>
                <FeedbackStateTitle>Nelze odemknout</FeedbackStateTitle>
                <FeedbackStateDescription>{errorMessage}</FeedbackStateDescription>
              </FeedbackStateContent>
            </FeedbackState>
          ) : null}

          <Button type="submit" size="lg" className="auth-submit" loading={isSubmitting}>
            Odemknout
          </Button>
        </form>
      </section>
    </main>
  )
}
