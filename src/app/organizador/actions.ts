'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { EVENTS_TAG, FLYERS_BUCKET } from '@/lib/events'
import { fromLocalInputs, slugify } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

type EventStatus = Database['public']['Enums']['event_status']
export type EventFormState = { error?: string }

const STATUSES: EventStatus[] = ['borrador', 'publicado', 'cancelado']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/
// Los flyers se suben desde el navegador con nombre aleatorio (ver EventForm).
const FLYER_PATH_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/

/** Cada acción re-verifica el rol: no alcanza con ocultar botones (y RLS es la última barrera). */
async function requireOrganizer() {
  const user = await getCurrentUser()
  if (!user) redirect('/ingresar?next=/organizador')
  if (!hasRole(user, 'organizador')) throw new Error('Solo un organizador puede hacer esto.')
  return createClient()
}

export async function saveEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const supabase = await requireOrganizer()

  const id = String(formData.get('id') ?? '') || null
  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ')
  const date = String(formData.get('date') ?? '')
  const startTime = String(formData.get('startTime') ?? '')
  const endTime = String(formData.get('endTime') ?? '')
  const description = String(formData.get('description') ?? '').trim()
  const status = String(formData.get('status') ?? 'borrador') as EventStatus
  const newFlyer = String(formData.get('flyerPath') ?? '') || null
  const removeFlyer = formData.get('removeFlyer') === 'on'

  if (name.length < 2 || name.length > 120) return { error: 'El nombre tiene que tener entre 2 y 120 caracteres.' }
  if (!DATE_RE.test(date) || !TIME_RE.test(startTime)) return { error: 'Completá la fecha y la hora de inicio.' }
  if (endTime && !TIME_RE.test(endTime)) return { error: 'La hora de cierre no es válida.' }
  if (description.length > 4000) return { error: 'La descripción es demasiado larga (máximo 4000 caracteres).' }
  if (!STATUSES.includes(status)) return { error: 'Estado inválido.' }
  if (newFlyer && !FLYER_PATH_RE.test(newFlyer)) return { error: 'El flyer no se subió correctamente. Probá de nuevo.' }

  const startsAt = fromLocalInputs(date, startTime)
  let endsAt: string | null = null
  if (endTime) {
    endsAt = fromLocalInputs(date, endTime)
    // Las noches terminan después de medianoche: si cierra "antes" de abrir, es al día siguiente.
    if (endsAt <= startsAt) endsAt = new Date(new Date(endsAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
  }

  const fields = { name, description, starts_at: startsAt, ends_at: endsAt, status }

  if (!id) {
    const baseSlug = `${slugify(name) || 'evento'}-${date}`
    let { error } = await supabase.from('events').insert({ ...fields, slug: baseSlug, flyer_path: newFlyer })
    if (error?.code === '23505') {
      // Ya existe un evento con el mismo nombre y fecha: se agrega un sufijo corto.
      ;({ error } = await supabase
        .from('events')
        .insert({ ...fields, slug: `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`, flyer_path: newFlyer }))
    }
    if (error) {
      if (newFlyer) await supabase.storage.from(FLYERS_BUCKET).remove([newFlyer])
      return { error: 'No se pudo crear el evento. Probá de nuevo.' }
    }
  } else {
    const { data: current } = await supabase.from('events').select('flyer_path').eq('id', id).maybeSingle()
    if (!current) return { error: 'El evento ya no existe.' }

    const flyerPath = newFlyer ?? (removeFlyer ? null : current.flyer_path)
    const { error } = await supabase.from('events').update({ ...fields, flyer_path: flyerPath }).eq('id', id)
    if (error) {
      if (newFlyer) await supabase.storage.from(FLYERS_BUCKET).remove([newFlyer])
      return { error: 'No se pudieron guardar los cambios. Probá de nuevo.' }
    }
    if (current.flyer_path && current.flyer_path !== flyerPath) {
      await supabase.storage.from(FLYERS_BUCKET).remove([current.flyer_path])
    }
  }

  updateTag(EVENTS_TAG) // la web pública se actualiza al instante
  redirect('/organizador')
}

export async function setEventStatus(formData: FormData) {
  const supabase = await requireOrganizer()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '') as EventStatus
  if (!id || !STATUSES.includes(status)) return

  await supabase.from('events').update({ status }).eq('id', id)
  updateTag(EVENTS_TAG)
  redirect('/organizador')
}

export async function deleteEvent(formData: FormData) {
  const supabase = await requireOrganizer()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const { data: deleted } = await supabase.from('events').delete().eq('id', id).select('flyer_path').maybeSingle()
  if (deleted?.flyer_path) await supabase.storage.from(FLYERS_BUCKET).remove([deleted.flyer_path])
  updateTag(EVENTS_TAG)
  redirect('/organizador')
}
