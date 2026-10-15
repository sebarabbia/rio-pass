import 'server-only'
import { redirect } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Para Server Actions del panel: exige rol organizador y devuelve el cliente con su sesión. */
export async function requireOrganizer() {
  const user = await getCurrentUser()
  if (!user) redirect('/ingresar?next=/organizador')
  if (!hasRole(user, 'organizador')) throw new Error('Solo un organizador puede hacer esto.')
  return createClient()
}

/**
 * Deja los sectores (ticket_types) del evento iguales a la lista: crea los nuevos,
 * reactiva los que vuelven y desactiva los que se sacaron (no se borran porque
 * puede haber QR emitidos para ese sector).
 */
export async function syncSectors(supabase: Supabase, eventId: string, names: string[]) {
  const { data: existing } = await supabase.from('ticket_types').select('id, name, is_active').eq('event_id', eventId)
  const byName = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t]))

  for (const [index, name] of names.entries()) {
    const found = byName.get(name.toLowerCase())
    if (found) {
      await supabase.from('ticket_types').update({ name, is_active: true, sort_order: index }).eq('id', found.id)
    } else {
      await supabase.from('ticket_types').insert({ event_id: eventId, name, sort_order: index })
    }
  }
  const keep = new Set(names.map((n) => n.toLowerCase()))
  for (const t of existing ?? []) {
    if (t.is_active && !keep.has(t.name.toLowerCase())) {
      await supabase.from('ticket_types').update({ is_active: false }).eq('id', t.id)
    }
  }
}

/** Organizadores (para elegir responsable de RRPP y filtrar), ordenados por nombre. */
export async function getOrganizers(supabase: Supabase) {
  const { data } = await supabase
    .from('user_roles')
    .select('profile:profiles!user_roles_user_id_fkey(id, full_name, email)')
    .eq('role', 'organizador')
  return (data ?? [])
    .map((r) => r.profile)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ id: p.id, name: p.full_name || p.email || 'Sin nombre' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
