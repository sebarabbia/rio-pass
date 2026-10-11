import 'server-only'
import { cacheLife } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

// Puntos y ranking por temporada. Hay dos ligas: la de clientes (pública) y la
// de RRPP (interna, solo la ven RRPP y organizadores). Ver migración 08.

export type League = 'clientes' | 'rrpp'
export type RankingRow = Database['public']['Functions']['season_ranking']['Returns'][number]
export type PointsReason = Database['public']['Enums']['points_reason']

/** Lo que devuelve my_ranking(): la situación del usuario logueado en su liga. */
export type MyRanking = {
  season_id: string
  season_name: string
  season_ends_on: string
  league: League
  points: number
  attendances: number
  position: number | null
  players: number
  gap_to_top10: number
}

export const PRIZE_POSITIONS = 10

export const REASON_LABELS: Record<PointsReason, string> = {
  asistencia: 'Asistencia',
  compra: 'Compra',
  ajuste: 'Ajuste',
  premio: 'Premio',
}

/** Ranking de la temporada actual con la sesión del usuario (marca su fila). */
export async function getRanking(league: League, limit = 50): Promise<RankingRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('season_ranking', { _league: league, _limit: limit })
  if (error) throw new Error(`No se pudo cargar el ranking: ${error.message}`)
  return data
}

/** Posición y puntos del usuario logueado en la temporada actual (null si no hay temporada). */
export async function getMyRanking(): Promise<MyRanking | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_ranking')
  if (error) throw new Error(`No se pudo cargar tu posición: ${error.message}`)
  return (data as MyRanking | null) ?? null
}

/** Podio para la home: público y cacheado un rato (no depende de quién mira). */
export async function getPublicPodium(): Promise<{ season: string | null; rows: RankingRow[] }> {
  'use cache'
  cacheLife('minutes')

  const supabase = createPublicClient()
  const [{ data: season }, { data: rows }] = await Promise.all([
    supabase.from('seasons').select('name').eq('is_current', true).maybeSingle(),
    supabase.rpc('season_ranking', { _league: 'clientes', _limit: 3 }),
  ])
  return { season: season?.name ?? null, rows: rows ?? [] }
}

/** Texto corto de cómo viene el usuario respecto del top 10. */
export function standingMessage(me: MyRanking) {
  if (me.position && me.position <= PRIZE_POSITIONS) {
    return me.position === 1 ? 'Vas primero. ¡Que no te alcancen!' : `Estás en el top ${PRIZE_POSITIONS}. ¡Que no te pasen!`
  }
  if (me.points <= 0) return 'Todavía no sumaste puntos: vení a la próxima y entrás al ranking.'
  return `Te ${me.gap_to_top10 === 1 ? 'falta 1 punto' : `faltan ${me.gap_to_top10} puntos`} para entrar al top ${PRIZE_POSITIONS}.`
}
