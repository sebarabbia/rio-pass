'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type InvitationFormState = {
  error?: string
  created?: { code: string; holderName: string; phone: string | null }
  fields?: { name?: string; email?: string; phone?: string }
}

// Los errores vienen como códigos desde las funciones de la base (issue_invitation, void_ticket).
const ERRORS: Record<string, string> = {
  sin_permiso: 'No tenés permiso para emitir invitaciones.',
  nombre_invalido: 'Escribí el nombre del invitado.',
  email_invalido: 'Ese email no parece válido.',
  telefono_invalido: 'El celular solo puede tener números, espacios, + y guiones.',
  evento_inexistente: 'El evento ya no existe.',
  evento_no_disponible: 'Este evento ya no admite invitaciones.',
  cupo_agotado: 'Llegaste al cupo de invitaciones para este evento.',
  sector_invalido: 'Elegí un sector válido.',
  qr_inexistente: 'Ese QR ya no existe.',
  qr_no_anulable: 'Solo se pueden anular QR que no se usaron.',
}

function revalidateInvitationPages(eventId: string) {
  revalidatePath(`/rrpp/${eventId}`)
  revalidatePath(`/organizador/eventos/${eventId}/invitaciones`)
  revalidatePath('/rrpp')
}

export async function issueInvitation(_prev: InvitationFormState, formData: FormData): Promise<InvitationFormState> {
  if (!(await getCurrentUser())) redirect('/ingresar')

  const eventId = String(formData.get('eventId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const sectorId = String(formData.get('sectorId') ?? '')
  const fields = { name, email, phone }

  if (name.length < 2) return { error: ERRORS.nombre_invalido, fields }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('issue_invitation', {
    _event_id: eventId,
    _holder_name: name,
    _holder_email: email || undefined,
    _holder_phone: phone || undefined,
    _ticket_type_id: sectorId || undefined,
  })
  if (error || !data) return { error: ERRORS[error?.message ?? ''] ?? 'No se pudo emitir la invitación. Probá de nuevo.', fields }

  revalidateInvitationPages(eventId)
  return { created: { code: data.code, holderName: data.holder_name ?? name, phone: data.holder_phone } }
}

export async function voidInvitation(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/ingresar')

  const ticketId = String(formData.get('ticketId') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  const supabase = await createClient()
  await supabase.rpc('void_ticket', { _ticket_id: ticketId })
  revalidateInvitationPages(eventId)
}
