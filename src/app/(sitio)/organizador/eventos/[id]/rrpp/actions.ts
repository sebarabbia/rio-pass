'use server'

import { revalidatePath } from 'next/cache'
import { requireOrganizer } from '@/lib/organizer'

const UUID_RE = /^[0-9a-f-]{36}$/

function revalidate(eventId: string) {
  revalidatePath(`/organizador/eventos/${eventId}/rrpp`)
  revalidatePath('/organizador')
  revalidatePath('/rrpp')
}

/** Habilita o deshabilita uno o varios RRPP para la fecha (ids separados por coma). */
export async function setRrppAccess(formData: FormData) {
  const supabase = await requireOrganizer()
  const eventId = String(formData.get('eventId') ?? '')
  const ids = String(formData.get('ids') ?? '').split(',').filter((id) => UUID_RE.test(id))
  const enabled = formData.get('enabled') === '1'
  if (!UUID_RE.test(eventId) || ids.length === 0) throw new Error('Datos inválidos')
  const { error } = await supabase.rpc('set_rrpp_access', { _event_id: eventId, _rrpp_ids: ids, _enabled: enabled })
  if (error) throw new Error(error.message)
  revalidate(eventId)
}

/** QR extra para un RRPP que se lo ganó (además de los de la fecha). */
export async function setRrppExtra(formData: FormData) {
  const supabase = await requireOrganizer()
  const eventId = String(formData.get('eventId') ?? '')
  const id = String(formData.get('id') ?? '')
  const extra = Number(formData.get('extra'))
  if (!UUID_RE.test(eventId) || !UUID_RE.test(id) || !Number.isInteger(extra) || extra < 0 || extra > 50) {
    throw new Error('Datos inválidos')
  }
  const { error } = await supabase.rpc('set_rrpp_access', { _event_id: eventId, _rrpp_ids: [id], _enabled: true, _extra: extra })
  if (error) throw new Error(error.message)
  revalidate(eventId)
}
