'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login, type AuthFormState } from '@/app/auth/actions'
import { PasswordInput } from '@/components/PasswordInput'
import { SubmitButton } from '@/components/SubmitButton'

export function LoginForm() {
  const params = useSearchParams()
  const [state, formAction] = useActionState<AuthFormState, FormData>(login, {})
  const linkError = params.get('error') === 'link'

  return (
    <form action={formAction} className="card form-card" noValidate>
      <input type="hidden" name="next" value={params.get('next') ?? '/cuenta'} />
      {linkError && !state.error && (
        <p className="form-error" role="alert">
          El link venció o ya se usó. Ingresá con tu email y contraseña, o pedí uno nuevo en “¿Olvidaste tu contraseña?”.
        </p>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.fields?.email}
          required
        />
      </div>
      <div className="field">
        <div className="label-row">
          <label htmlFor="password">Contraseña</label>
          <Link href="/recuperar" className="label-link">¿Olvidaste tu contraseña?</Link>
        </div>
        <PasswordInput id="password" autoComplete="current-password" />
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <SubmitButton pendingText="Ingresando…">Ingresar</SubmitButton>
    </form>
  )
}
