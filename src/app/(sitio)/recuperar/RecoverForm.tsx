'use client'

import { useActionState } from 'react'
import { requestPasswordReset, type AuthFormState } from '@/app/auth/actions'
import { SubmitButton } from '@/components/SubmitButton'

export function RecoverForm({ submitLabel = 'Mandarme el link' }: { submitLabel?: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(requestPasswordReset, {})

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
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" inputMode="email" defaultValue={state.fields?.email} required />
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <SubmitButton pendingText="Enviando…">{submitLabel}</SubmitButton>
    </form>
  )
}
