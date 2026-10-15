'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ensureAccount } from '@/lib/accounts'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type InvitationFormState = {
  error?: string
  created?: { code: string; holderName: string; phone: string | null; email: string; accountCreated: boolean }
  fields?: { name?: string; email?: string; phone?: string }
}

// Los errores vienen como códigos desde las funciones de la base (issue_invitation, void_ticket).
const ERRORS: Record<string, string> = {
  sin_permiso: 'No tenés permiso para emitir invitaciones.',
  nombre_invalido: 'Escribí el nombre del invitado.',
  email_invalido: 'Ese email no parece válido.',
  email_requerido: 'El email es obligatorio: cada QR queda asociado a una cuenta.',
  ya_tiene_qr: 'Esa persona ya tiene un QR para esta fecha.',
  rrpp_no_habilitado: 'Todavía no te habilitaron los QR de esta fecha (se habilitan después de la primera difusión).',
  tope_alcanzado: 'Se llegó al tope de QR sin cargo de esta fecha. Ya no se pueden regalar más.',
  telefono_invalido: 'El celular solo puede tener números, espacios, + y guiones.',
  evento_inexistente: 'El evento ya no existe.',
  evento_no_disponible: 'Este evento ya no admite invitaciones.',
  cupo_agotado: 'Ya usaste todos tus QR para esta fecha.',
  sector_invalido: 'Elegí un sector válido.',
  qr_inexistente: 'Ese QR ya no existe.',
  qr_no_anulable: 'Solo se pueden anular QR que no se usaron.',
}

function revalidateInvitationPages(eventId: string) {
  revalidatePath(`/rrpp/${eventId}`)
  revalidatePath(`/organizador/eventos/${eventId}/invitaciones`)
  revalidatePath(`/organizador/eventos/${eventId}/rrpp`)
  revalidatePath('/organizador')
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
  if (!email) return { error: ERRORS.email_requerido, fields }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('issue_invitation', {
    _event_id: eventId,
    _holder_name: name,
    _holder_email: email || undefined,
    _holder_phone: phone || undefined,
    _ticket_type_id: sectorId || undefined,
  })
  if (error || !data) return { error: ERRORS[error?.message ?? ''] ?? 'No se pudo emitir la invitación. Probá de nuevo.', fields }

  // Sin cuenta con ese email: se le crea una (el QR se le asocia solo, por el email).
  let accountCreated = false
  if (!data.user_id && data.holder_email) {
    try {
      accountCreated = (await ensureAccount(supabase, { email: data.holder_email, full_name: name, phone: phone || null })).created
    } catch {
      // El QR ya está emitido y vale igual: si después se registra con ese email, se le asocia.
    }
  }

  revalidateInvitationPages(eventId)
  return {
    created: {
      code: data.code,
      holderName: data.holder_name ?? name,
      phone: data.holder_phone,
      email: data.holder_email ?? email,
      accountCreated,
    },
  }
}

export async function voidInvitation(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/ingresar')

  const ticketId = String(formData.get('ticketId') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  const supabase = await createClient()
  await supabase.rpc('void_ticket', { _ticket_id: ticketId })
  revalidateInvitationPages(eventId)
}
