import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export type AppRole = Database['public']['Enums']['app_role']

export type CurrentUser = {
  id: string
  email: string | null
  fullName: string
  phone: string | null
  createdAt: string | null
  roles: AppRole[]
}

/**
 * Usuario logueado con su perfil y roles, o null. Se resuelve una sola vez por
 * request (React cache). Lee cookies: llamarlo dentro de un <Suspense>.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, email, created_at').eq('id', claims.sub).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', claims.sub),
  ])

  return {
    id: claims.sub,
    email: profile?.email ?? (typeof claims.email === 'string' ? claims.email : null),
    fullName: profile?.full_name ?? '',
    phone: profile?.phone ?? null,
    createdAt: profile?.created_at ?? null,
    roles: (roles ?? []).map((r) => r.role),
  }
})

/** Exige sesión: si no hay, manda a /ingresar (el proxy ya lo hace antes, esto es la segunda barrera). */
export async function requireUser(next = '/cuenta'): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(next)}`)
  return user
}

export function hasRole(user: CurrentUser | null, role: AppRole) {
  return Boolean(user?.roles.includes(role))
}

export const ROLE_LABELS: Record<AppRole, string> = {
  cliente: 'Cliente',
  rrpp: 'RRPP',
  organizador: 'Organizador',
  acreditador: 'Acreditador',
  barra: 'Barra exprés',
}
