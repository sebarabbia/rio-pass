import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { Tables } from '@/lib/database.types'

export type PublicEvent = Pick<
  Tables<'events'>,
  'id' | 'slug' | 'name' | 'description' | 'starts_at' | 'ends_at' | 'flyer_path'
>

const PUBLIC_EVENT_COLUMNS = 'id, slug, name, description, starts_at, ends_at, flyer_path'

// Tag de caché de todo lo público de eventos. Las acciones del organizador lo
// invalidan con updateTag(EVENTS_TAG) para que la web pública se actualice al toque.
export const EVENTS_TAG = 'events'

export const FLYERS_BUCKET = 'event-flyers'

export function flyerUrl(path: string | null) {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${FLYERS_BUCKET}/${path}`
}

/** Próximos eventos publicados (incluye los de hoy hasta 12 h después de empezar). */
export async function getUpcomingEvents(): Promise<PublicEvent[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(EVENTS_TAG)

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const { data, error } = await createPublicClient()
    .from('events')
    .select(PUBLIC_EVENT_COLUMNS)
    .eq('status', 'publicado')
    .gte('starts_at', since)
    .order('starts_at', { ascending: true })
    .limit(24)

  if (error) throw new Error(`No se pudieron cargar los eventos: ${error.message}`)
  return data
}

/** Un evento publicado por su slug, o null. */
export async function getPublicEvent(slug: string): Promise<PublicEvent | null> {
  'use cache'
  cacheLife('minutes')
  cacheTag(EVENTS_TAG)

  const { data, error } = await createPublicClient()
    .from('events')
    .select(PUBLIC_EVENT_COLUMNS)
    .eq('status', 'publicado')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar el evento: ${error.message}`)
  return data
}
