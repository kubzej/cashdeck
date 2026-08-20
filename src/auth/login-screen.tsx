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
          <h1 id="login-title" className="brand-name">Cashdeck</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field invalid={Boolean(errorMessage)}>
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
                disabled={isSubmitting}
                required
              />
            </div>
          </Field>

          <Field invalid={Boolean(errorMessage)}>
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
