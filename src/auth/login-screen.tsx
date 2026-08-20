import { useState, type FormEvent } from 'react'
import { CircleAlert, LockKeyhole, Mail, UserRound } from 'lucide-react'
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

type AuthMode = 'sign-in' | 'sign-up'

export function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password || (isSignUp && !name.trim())) {
      setErrorMessage('Vyplň všechny údaje.')
      return
    }

    setIsSubmitting(true)
    const error = isSignUp
      ? await signUp(name.trim(), email.trim(), password)
      : await signIn(email.trim(), password)
    setErrorMessage(error)
    setIsSubmitting(false)
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setErrorMessage(null)
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
          <p className="eyebrow">{isSignUp ? 'První nastavení' : 'Vítej zpět'}</p>
          <h1 id="login-title">{isSignUp ? 'Vytvořit účet' : 'Přihlášení'}</h1>
          <p>{isSignUp ? 'Vytvoř si jediný přístup k Cashdecku.' : 'Přihlas se ke svému přehledu financí.'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignUp ? (
            <Field>
              <FieldLabel>Jméno</FieldLabel>
              <div className="auth-input-wrap">
                <UserRound aria-hidden="true" />
                <Input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </Field>
          ) : null}

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
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
                <FeedbackStateTitle>{isSignUp ? 'Účet se nepodařilo vytvořit' : 'Nelze se přihlásit'}</FeedbackStateTitle>
                <FeedbackStateDescription>{errorMessage}</FeedbackStateDescription>
              </FeedbackStateContent>
            </FeedbackState>
          ) : null}

          <Button type="submit" size="lg" className="auth-submit" loading={isSubmitting}>
            {isSignUp ? 'Vytvořit účet' : 'Přihlásit se'}
          </Button>
        </form>

        <Button
          type="button"
          variant="link"
          className="auth-mode-toggle"
          onClick={() => switchMode(isSignUp ? 'sign-in' : 'sign-up')}
        >
          {isSignUp ? 'Mám účet, přihlásit se' : 'Vytvořit první účet'}
        </Button>
      </section>
    </main>
  )
}
