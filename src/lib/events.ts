import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { SUPABASE_URL } from '@/lib/supabase/config'
import type { Tables } from '@/lib/database.types'

export type PublicEvent = Pick<
  Tables<'events'>,
  'id' | 'slug' | 'name' | 'description' | 'starts_at' | 'ends_at' | 'flyer_path' | 'venue'
> & { sectors: string[]; going: number }

// Los sectores salen de ticket_types: RLS solo deja ver los activos de eventos publicados.
const PUBLIC_EVENT_COLUMNS = 'id, slug, name, description, starts_at, ends_at, flyer_path, venue, ticket_types(name, sort_order)'

type EventWithTypes = Omit<PublicEvent, 'sectors' | 'going'> & { ticket_types: { name: string; sort_order: number }[] }

function withSectors({ ticket_types, ...event }: EventWithTypes, going = 0): PublicEvent {
  return { ...event, sectors: [...ticket_types].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.name), going }
}

/** A partir de cuántos QR entregados se muestra el contador en la web (con pocos, juega en contra). */
export const GOING_MIN = 15

/** QR entregados por fecha (contador público; la función no expone datos personales). */
async function goingCounts(ids: string[]) {
  if (ids.length === 0) return new Map<string, number>()
  const { data } = await createPublicClient().rpc('event_going_counts', { _event_ids: ids })
  return new Map((data ?? []).map((r) => [r.event_id, r.going]))
}

// Tag de caché de todo lo público de eventos. Las acciones del organizador lo
// invalidan con updateTag(EVENTS_TAG) para que la web pública se actualice al toque.
export const EVENTS_TAG = 'events'

export const FLYERS_BUCKET = 'event-flyers'

export function flyerUrl(path: string | null) {
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/${FLYERS_BUCKET}/${path}`
}

/** Desde cuándo un evento cuenta como "próximo": incluye los que empezaron hace menos de 12 h. */
export function upcomingSince() {
  return new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
}

/** Próximos eventos publicados. */
export async function getUpcomingEvents(): Promise<PublicEvent[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(EVENTS_TAG)

  const { data, error } = await createPublicClient()
    .from('events')
    .select(PUBLIC_EVENT_COLUMNS)
    .eq('status', 'publicado')
    .gte('starts_at', upcomingSince())
    .order('starts_at', { ascending: true })
    .limit(24)

  if (error) throw new Error(`No se pudieron cargar los eventos: ${error.message}`)
  const going = await goingCounts(data.map((e) => e.id))
  return data.map((e) => withSectors(e, going.get(e.id) ?? 0))
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
  if (!data) return null
  const going = await goingCounts([data.id])
  return withSectors(data, going.get(data.id) ?? 0)
}
