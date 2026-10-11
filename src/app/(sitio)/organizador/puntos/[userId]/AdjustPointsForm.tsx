'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { adjustPoints, type AdjustPointsState } from '../actions'

export function AdjustPointsForm({ userId, seasonId, seasonName }: { userId: string; seasonId: string; seasonName: string }) {
  const [state, formAction] = useActionState<AdjustPointsState, FormData>(adjustPoints, {})
  return (
    <form action={formAction} className="card form-card" noValidate>
      <p className="card-title">Sumar o restar puntos</p>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <div className="field-row two">
        <div className="field">
          <label htmlFor="adj-points">Puntos</label>
          <input id="adj-points" name="points" type="number" inputMode="numeric" step={1} min={-10000} max={10000} className="input" placeholder="20 o -10" required />
        </div>
        <div className="field">
          <label htmlFor="adj-reason">Motivo</label>
          <select id="adj-reason" name="reason" className="input" defaultValue="premio">
            <option value="premio">Premio (bonus)</option>
            <option value="ajuste">Ajuste (corrección)</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="adj-note">
          Nota <span className="optional">(obligatoria en ajustes)</span>
        </label>
        <input id="adj-note" name="note" className="input" maxLength={200} placeholder="Ej.: cumpleaños, sorteo de Instagram, ingreso no registrado" />
      </div>
      <p className="hint">Se cargan en la temporada {seasonName}. Los movimientos no se borran: para corregir uno, cargá otro en sentido contrario.</p>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.message && <p className="form-ok" role="status">{state.message}</p>}
      <SubmitButton pendingText="Cargando…">Cargar movimiento</SubmitButton>
    </form>
  )
}
