'use client'

import { useActionState, useEffect, useRef } from 'react'
import { issueInvitation, type InvitationFormState } from '@/actions/invitations'
import { ShareInvitation } from '@/components/ShareInvitation'
import { SubmitButton } from '@/components/SubmitButton'

type Props = {
  eventId: string
  eventName: string
  when: string
  origin: string
  sectors: { id: string; name: string }[]
  disabled?: boolean
  /** Por qué no se puede emitir (cupo agotado, tope, sin habilitar). */
  disabledReason?: string
}

export function InvitationForm({ eventId, eventName, when, origin, sectors, disabled, disabledReason }: Props) {
  const [state, formAction] = useActionState<InvitationFormState, FormData>(issueInvitation, {})
  const successRef = useRef<HTMLDivElement>(null)

  // En el celular el aviso queda arriba del formulario: se lleva a la vista para
  // que el RRPP vea enseguida el botón de WhatsApp.
  useEffect(() => {
    if (!state.created) return
    successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    successRef.current?.focus({ preventScroll: true })
  }, [state.created])

  return (
    <div className="stack">
      {state.created && (
        <div className="card success-card" role="status" ref={successRef} tabIndex={-1}>
          <p className="card-title">Invitación lista para {state.created.holderName}</p>
          <p className="muted">
            Mandale el link: ahí ve su QR para mostrar en la puerta.{' '}
            {state.created.accountCreated
              ? `Le creamos una cuenta con ${state.created.email}: el QR ya está ahí y la activa eligiendo su contraseña.`
              : `También le aparece en su cuenta (${state.created.email}).`}
          </p>
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
          <label htmlFor="inv-email">Email</label>
          <input id="inv-email" name="email" type="email" inputMode="email" className="input" autoComplete="off" autoCapitalize="none" maxLength={120} defaultValue={state.fields?.email} required aria-describedby="inv-email-hint" />
          <p id="inv-email-hint" className="hint">Obligatorio: el QR queda en su cuenta. Si no tiene, se la creamos con este email.</p>
        </div>
        <div className="field">
          <label htmlFor="inv-phone">
            Celular <span className="optional">(para mandarlo por WhatsApp)</span>
          </label>
          <input id="inv-phone" name="phone" type="tel" inputMode="tel" className="input" placeholder="343 456 7890" maxLength={30} defaultValue={state.fields?.phone} />
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
          <p className="form-error">{disabledReason ?? 'Ya usaste todos tus QR para esta fecha. Anulá uno sin usar para liberar un lugar.'}</p>
        ) : (
          <SubmitButton pendingText="Generando QR…">Generar QR</SubmitButton>
        )}
      </form>
    </div>
  )
}
