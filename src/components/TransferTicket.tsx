'use client'

import { useActionState } from 'react'
import { transferPurchasedTicket, type TransferState } from '@/actions/sales'
import { SubmitButton } from '@/components/SubmitButton'

/** Pasar una entrada comprada a otra persona: le llega a su cuenta (si no tiene, se le crea). */
export function TransferTicket({ ticketId }: { ticketId: string }) {
  const [state, formAction] = useActionState<TransferState, FormData>(transferPurchasedTicket, {})
  if (state.message) return <p className="form-ok transfer-done" role="status">{state.message}</p>
  return (
    <details className="transfer">
      <summary>Pasar a otra persona</summary>
      <form action={formAction} className="transfer-form" noValidate>
        <input type="hidden" name="ticketId" value={ticketId} />
        <input name="name" className="input" placeholder="Nombre y apellido" autoComplete="off" maxLength={80} required aria-label="Nombre de la persona" />
        <input name="email" type="email" inputMode="email" className="input" placeholder="Su email" autoComplete="off" autoCapitalize="none" required aria-label="Email de la persona" />
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <SubmitButton className="btn btn-secondary btn-sm" pendingText="Pasando…">Pasar entrada</SubmitButton>
        <p className="muted small">La entrada pasa a su cuenta y tu QR deja de servir.</p>
      </form>
    </details>
  )
}
