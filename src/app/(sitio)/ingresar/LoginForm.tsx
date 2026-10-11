'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login, type AuthFormState } from '@/app/auth/actions'
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
          El link de confirmación venció o ya se usó. Ingresá con tu email y contraseña.
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
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <SubmitButton pendingText="Ingresando…">Ingresar</SubmitButton>
    </form>
  )
}
