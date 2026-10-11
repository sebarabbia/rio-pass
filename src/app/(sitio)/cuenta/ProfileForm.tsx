'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { updateProfile, type ProfileFormState } from './actions'

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string | null; email: string | null }) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(updateProfile, {})

  return (
    <form action={formAction} className="stack" noValidate>
      <div className="field">
        <label htmlFor="fullName">Nombre y apellido</label>
        <input id="fullName" name="fullName" className="input" autoComplete="name" maxLength={80} defaultValue={fullName} required />
      </div>
      <div className="field">
        <label htmlFor="phone">
          Celular <span className="optional">(opcional)</span>
        </label>
        <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" inputMode="tel" maxLength={30} defaultValue={phone ?? ''} />
      </div>
      <div className="field">
        <span className="label">Email</span>
        <p className="readonly">{email ?? '—'}</p>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.message && <p className="form-ok" role="status">{state.message}</p>}
      <SubmitButton className="btn btn-secondary btn-block">Guardar cambios</SubmitButton>
    </form>
  )
}
