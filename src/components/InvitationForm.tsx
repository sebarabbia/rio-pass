'use client'

import { useActionState } from 'react'
import { issueInvitation, type InvitationFormState } from '@/app/invitaciones/actions'
import { ShareInvitation } from '@/components/ShareInvitation'
import { SubmitButton } from '@/components/SubmitButton'

type Props = {
  eventId: string
  eventName: string
  when: string
  origin: string
  sectors: { id: string; name: string }[]
  disabled?: boolean
}

export function InvitationForm({ eventId, eventName, when, origin, sectors, disabled }: Props) {
  const [state, formAction] = useActionState<InvitationFormState, FormData>(issueInvitation, {})

  return (
    <div className="stack">
      {state.created && (
        <div className="card success-card" role="status">
          <p className="card-title">Invitación lista para {state.created.holderName}</p>
          <p className="muted">Mandale el link: ahí ve su QR para mostrar en la puerta.</p>
          <ShareInvitation
            url={`${origin}/qr/${state.created.code}`}
            holderName={state.created.holderName}
            phone={state.created.phone}
            eventName={eventName}
            when={when}
          />
        </div>
      )}

      <form action={formAction} className="card form-card" noValidate>
        <input type="hidden" name="eventId" value={eventId} />
        <p className="card-title">Nueva invitación</p>
        <div className="field">
          <label htmlFor="inv-name">Nombre del invitado</label>
          <input id="inv-name" name="name" className="input" autoComplete="off" autoCapitalize="words" maxLength={80} defaultValue={state.fields?.name} required />
        </div>
        <div className="field">
          <label htmlFor="inv-phone">
            Celular <span className="optional">(para mandarlo por WhatsApp)</span>
          </label>
          <input id="inv-phone" name="phone" type="tel" inputMode="tel" className="input" placeholder="343 456 7890" maxLength={30} defaultValue={state.fields?.phone} />
        </div>
        <div className="field">
          <label htmlFor="inv-email">
            Email <span className="optional">(opcional: si tiene cuenta, le aparece en “Mis QR”)</span>
          </label>
          <input id="inv-email" name="email" type="email" inputMode="email" className="input" autoComplete="off" defaultValue={state.fields?.email} />
        </div>
        {sectors.length > 0 && (
          <div className="field">
            <label htmlFor="inv-sector">Sector</label>
            <select id="inv-sector" name="sectorId" className="input" defaultValue={sectors[0].id}>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {disabled ? (
          <p className="form-error">Ya usaste todo tu cupo para este evento. Anulá una invitación sin usar para liberar un lugar.</p>
        ) : (
          <SubmitButton pendingText="Generando QR…">Generar QR</SubmitButton>
        )}
      </form>
    </div>
  )
}
