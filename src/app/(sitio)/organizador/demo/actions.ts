'use server'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { DEMO_EVENTS, DEMO_SEASON, DEMO_SLUGS } from '@/demo/events'
import { DEFAULT_SECTORS } from '@/lib/event-defaults'
import { EVENTS_TAG, FLYERS_BUCKET } from '@/lib/events'
import { fromLocalInputs } from '@/lib/format'
import { requireOrganizer, syncSectors } from '@/lib/organizer'

const FLYERS_DIR = path.join(process.cwd(), 'src/demo/flyers')

/**
 * Carga las fechas de ejemplo con la sesión del organizador: los flyers se suben a
 * Storage y los eventos se crean con las mismas reglas (RLS) que una carga a mano.
 * Si una fecha ya existe, la saltea.
 */
export async function loadDemoEvents() {
  const supabase = await requireOrganizer()

  // Temporada: se crea si no existe y queda como actual si no había ninguna.
  let { data: season } = await supabase.from('seasons').select('id').eq('name', DEMO_SEASON.name).maybeSingle()
  if (!season) {
    const { data: current } = await supabase.from('seasons').select('id').eq('is_current', true).maybeSingle()
    ;({ data: season } = await supabase
      .from('seasons')
      .insert({ ...DEMO_SEASON, is_current: !current })
      .select('id')
      .single())
  }

  const { data: existing } = await supabase.from('events').select('slug').in('slug', DEMO_SLUGS)
  const already = new Set((existing ?? []).map((e) => e.slug))

  for (const demo of DEMO_EVENTS) {
    if (already.has(demo.slug)) continue

    const flyerPath = `${crypto.randomUUID()}.${demo.flyer.ext}`
    const file = await readFile(path.join(FLYERS_DIR, demo.flyer.file))
    const upload = await supabase.storage
      .from(FLYERS_BUCKET)
      .upload(flyerPath, file, { contentType: demo.flyer.contentType, cacheControl: '31536000' })

    const startsAt = fromLocalInputs(demo.date, demo.startTime)
    const endsAt = new Date(new Date(fromLocalInputs(demo.date, demo.endTime)).getTime() + 24 * 60 * 60 * 1000).toISOString()

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        slug: demo.slug,
        name: demo.name,
        description: demo.description,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'publicado',
        flyer_path: upload.error ? null : flyerPath,
        season_id: season?.id ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error(`No se pudo crear "${demo.name}": ${error.message}`)

    await syncSectors(supabase, event.id, DEFAULT_SECTORS)
  }

  updateTag(EVENTS_TAG)
  redirect('/organizador')
}

/** Borra las fechas de ejemplo (y sus flyers e invitaciones). No toca eventos reales. */
export async function removeDemoEvents() {
  const supabase = await requireOrganizer()
  const { data: deleted } = await supabase.from('events').delete().in('slug', DEMO_SLUGS).select('flyer_path')
  const flyers = (deleted ?? []).map((e) => e.flyer_path).filter((p): p is string => Boolean(p))
  if (flyers.length) await supabase.storage.from(FLYERS_BUCKET).remove(flyers)

  updateTag(EVENTS_TAG)
  redirect('/organizador')
}
