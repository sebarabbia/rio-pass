'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { createSeason, type SeasonFormState } from './actions'

export function SeasonForm() {
  const [state, formAction] = useActionState<SeasonFormState, FormData>(createSeason, {})
  return (
    <form action={formAction} className="card form-card" noValidate>
      <p className="card-title">Nueva temporada</p>
      <div className="field">
        <label htmlFor="season-name">Nombre</label>
        <input id="season-name" name="name" className="input" placeholder="Verano 2027" maxLength={60} required />
      </div>
      <div className="field-row two">
        <div className="field">
          <label htmlFor="season-start">Desde</label>
          <input id="season-start" name="startsOn" type="date" className="input" required />
        </div>
        <div className="field">
          <label htmlFor="season-end">Hasta</label>
          <input id="season-end" name="endsOn" type="date" className="input" required />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="current" defaultChecked /> Marcarla como temporada actual
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.message && <p className="form-ok" role="status">{state.message}</p>}
      <SubmitButton pendingText="Creando…">Crear temporada</SubmitButton>
    </form>
  )
}
