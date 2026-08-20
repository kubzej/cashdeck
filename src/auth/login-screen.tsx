import { useState, type FormEvent } from 'react'
import { CircleAlert, LockKeyhole, Mail } from 'lucide-react'
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
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage('Vyplň všechny údaje.')
      return
    }

    setIsSubmitting(true)
    const error = await signIn(email.trim(), password)
    setErrorMessage(error)
    setIsSubmitting(false)
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand-lockup">
          <img src="/cashdeck-mark.svg" alt="" className="auth-brand-mark" />
          <div>
            <p className="brand-name">Cashdeck</p>
            <p className="brand-context">Osobní finance</p>
          </div>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">Vítej zpět</p>
          <h1 id="login-title">Přihlášení</h1>
          <p>Přihlas se ke svému přehledu financí.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <div className="auth-input-wrap">
              <Mail aria-hidden="true" />
              <Input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="ty@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(errorMessage) || undefined}
                disabled={isSubmitting}
                required
              />
            </div>
          </Field>

          <Field>
            <FieldLabel>Heslo</FieldLabel>
            <div className="auth-input-wrap">
              <LockKeyhole aria-hidden="true" />
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Tvoje heslo"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errorMessage) || undefined}
                disabled={isSubmitting}
                required
              />
            </div>
          </Field>

          {errorMessage ? (
            <FeedbackState status="error" layout="inline">
              <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
              <FeedbackStateContent>
                <FeedbackStateTitle>Nelze se přihlásit</FeedbackStateTitle>
                <FeedbackStateDescription>{errorMessage}</FeedbackStateDescription>
              </FeedbackStateContent>
            </FeedbackState>
          ) : null}

          <Button type="submit" size="lg" className="auth-submit" loading={isSubmitting}>
            Přihlásit se
          </Button>
        </form>
      </section>
    </main>
  )
}
