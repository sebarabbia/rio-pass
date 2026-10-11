'use server'

import { revalidatePath } from 'next/cache'
import { requireOrganizer } from '@/lib/organizer'

export type SeasonFormState = { error?: string; message?: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function makeCurrent(supabase: Awaited<ReturnType<typeof requireOrganizer>>, id: string) {
  // Solo puede haber una actual: primero se desmarcan todas.
  await supabase.from('seasons').update({ is_current: false }).eq('is_current', true)
  return supabase.from('seasons').update({ is_current: true }).eq('id', id)
}

export async function createSeason(_prev: SeasonFormState, formData: FormData): Promise<SeasonFormState> {
  const supabase = await requireOrganizer()
  const name = String(formData.get('name') ?? '').trim()
  const startsOn = String(formData.get('startsOn') ?? '')
  const endsOn = String(formData.get('endsOn') ?? '')
  const current = formData.get('current') === 'on'

  if (name.length < 2 || name.length > 60) return { error: 'Poné un nombre, por ejemplo "Verano 2027".' }
  if (!DATE_RE.test(startsOn) || !DATE_RE.test(endsOn)) return { error: 'Completá las fechas de inicio y fin.' }
  if (endsOn < startsOn) return { error: 'La fecha de fin tiene que ser posterior al inicio.' }

  const { data, error } = await supabase.from('seasons').insert({ name, starts_on: startsOn, ends_on: endsOn }).select('id').single()
  if (error) return { error: error.code === '23505' ? 'Ya existe una temporada con ese nombre.' : 'No se pudo crear la temporada.' }
  if (current) await makeCurrent(supabase, data.id)

  revalidatePath('/organizador/temporadas')
  return { message: `Temporada "${name}" creada.` }
}

export async function setCurrentSeason(formData: FormData) {
  const supabase = await requireOrganizer()
  const id = String(formData.get('id') ?? '')
  if (id) await makeCurrent(supabase, id)
  revalidatePath('/organizador/temporadas')
}
