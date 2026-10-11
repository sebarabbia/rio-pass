'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signup, type AuthFormState } from '@/app/auth/actions'
import { PasswordInput } from '@/components/PasswordInput'
import { SubmitButton } from '@/components/SubmitButton'

export function RegisterForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signup, {})
  const next = useSearchParams().get('next') ?? '/cuenta'

  if (state.message) {
    return (
      <div className="card form-card" role="status">
        <p className="card-title">Revisá tu mail</p>
        <p>{state.message}</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="card form-card" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="fullName">Nombre y apellido</label>
        <input
          id="fullName"
          name="fullName"
          className="input"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={80}
          defaultValue={state.fields?.fullName}
          required
        />
      </div>
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
        <label htmlFor="phone">
          Celular <span className="optional">(opcional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="input"
          autoComplete="tel"
          inputMode="tel"
          placeholder="343 456 7890"
          maxLength={30}
          defaultValue={state.fields?.phone}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <PasswordInput id="password" autoComplete="new-password" minLength={8} describedBy="password-hint" />
        <p id="password-hint" className="hint">Mínimo 8 caracteres.</p>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  )
}
