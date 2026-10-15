'use server'

import { revalidatePath } from 'next/cache'
import { bulkCreateRrpp, type BulkResult, type Person } from '@/lib/accounts'
import { requireOrganizer } from '@/lib/organizer'

const UUID_RE = /^[0-9a-f-]{36}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Alta masiva de RRPP (la pantalla manda de a tandas de hasta 60). */
export async function bulkAddRrpp(people: Person[], managerId: string): Promise<BulkResult[]> {
  const supabase = await requireOrganizer()
  if (!UUID_RE.test(managerId)) throw new Error('Elegí el organizador responsable.')
  const rows = people
    .slice(0, 60)
    .map((p) => ({
      email: String(p.email ?? '').trim().toLowerCase(),
      full_name: String(p.full_name ?? '').trim().slice(0, 80),
      phone: p.phone ? String(p.phone).trim().slice(0, 30) : null,
    }))
    .filter((p) => EMAIL_RE.test(p.email))
  if (rows.length === 0) return []
  const results = await bulkCreateRrpp(supabase, rows, managerId)
  revalidatePath('/organizador/rrpp')
  return results
}

export async function setRrppManager(formData: FormData) {
  const supabase = await requireOrganizer()
  const id = String(formData.get('id') ?? '')
  const managerId = String(formData.get('managerId') ?? '')
  if (!UUID_RE.test(id) || (managerId && !UUID_RE.test(managerId))) throw new Error('Datos inválidos')
  const { error } = await supabase.rpc('set_rrpp_manager', { _rrpp_ids: [id], _manager_id: managerId || null })
  if (error) throw new Error(error.message)
  revalidatePath('/organizador/rrpp')
}

/** Saca a alguien de RRPP (queda como cliente; sus QR y puntos siguen). */
export async function removeRrpp(formData: FormData) {
  const supabase = await requireOrganizer()
  const id = String(formData.get('id') ?? '')
  if (!UUID_RE.test(id)) throw new Error('Datos inválidos')
  const { error } = await supabase.rpc('set_user_profile', { _user_id: id, _profile: 'cliente' })
  if (error) throw new Error(error.message)
  revalidatePath('/organizador/rrpp')
}
