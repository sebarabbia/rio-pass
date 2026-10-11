'use server'

import { revalidatePath } from 'next/cache'
import { requireOrganizer } from '@/lib/organizer'

export type AdjustPointsState = { error?: string; message?: string }

const UUID_RE = /^[0-9a-f-]{36}$/

/**
 * Carga un movimiento manual de puntos: un ajuste (+ o -, para corregir) o un
 * premio (bonus positivo). Los puntos de asistencia los suma solo la puerta.
 * RLS también exige organizador y motivo ajuste/premio.
 */
export async function adjustPoints(_prev: AdjustPointsState, formData: FormData): Promise<AdjustPointsState> {
  const supabase = await requireOrganizer()
  const userId = String(formData.get('userId') ?? '')
  const seasonId = String(formData.get('seasonId') ?? '')
  const points = Number(String(formData.get('points') ?? '').replace(/\s/g, ''))
  const reason = String(formData.get('reason') ?? '')
  const note = String(formData.get('note') ?? '').trim().replace(/\s+/g, ' ')

  if (!UUID_RE.test(userId) || !UUID_RE.test(seasonId)) return { error: 'Faltan datos. Recargá la página.' }
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 10000) {
    return { error: 'Poné una cantidad de puntos distinta de 0 (por ejemplo 20 o -10).' }
  }
  if (reason !== 'ajuste' && reason !== 'premio') return { error: 'Elegí el motivo.' }
  if (reason === 'premio' && points < 0) return { error: 'Un premio suma puntos: para restar usá "Ajuste".' }
  if (note.length > 200) return { error: 'La nota es muy larga (máximo 200 caracteres).' }
  if (reason === 'ajuste' && note.length < 3) return { error: 'Contá brevemente el motivo del ajuste (queda registrado).' }

  const { error } = await supabase
    .from('points_ledger')
    .insert({ user_id: userId, season_id: seasonId, points, reason, note: note || null })
  if (error) return { error: 'No se pudieron cargar los puntos.' }

  revalidatePath('/organizador/puntos', 'layout')
  return { message: `Listo: ${points > 0 ? `+${points}` : points} puntos.` }
}
