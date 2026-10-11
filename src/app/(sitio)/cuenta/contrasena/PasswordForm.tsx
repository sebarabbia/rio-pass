'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { updatePassword, type AuthFormState } from '@/app/auth/actions'
import { PasswordInput } from '@/components/PasswordInput'
import { SubmitButton } from '@/components/SubmitButton'

export function PasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(updatePassword, {})

  if (state.message) {
    return (
      <div className="card form-card" role="status">
        <p className="card-title">{state.message}</p>
        <Link href="/cuenta" className="btn btn-primary btn-block">Ir a mi cuenta</Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="card form-card" noValidate>
      <div className="field">
        <label htmlFor="password">Contraseña nueva</label>
        <PasswordInput id="password" autoComplete="new-password" minLength={8} describedBy="password-hint" />
        <p id="password-hint" className="hint">Mínimo 8 caracteres.</p>
      </div>
      <div className="field">
        <label htmlFor="confirm">Repetila</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} />
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  )
}
