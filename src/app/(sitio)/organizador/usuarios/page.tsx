import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ActionForm } from '@/components/ActionForm'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser, ROLE_LABELS, type AppRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OrganizerNav } from '../OrganizerNav'
import { toggleRole } from './actions'

export const metadata: Metadata = { title: 'Usuarios' }

const ASSIGNABLE: AppRole[] = ['rrpp', 'acreditador', 'barra', 'organizador']

export default function UsersPage({ searchParams }: PageProps<'/organizador/usuarios'>) {
  return (
    <Suspense fallback={<PageLoading label="Cargando usuarios…" />}>
      <Users searchParams={searchParams} />
    </Suspense>
  )
}

async function Users({ searchParams }: { searchParams: PageProps<'/organizador/usuarios'>['searchParams'] }) {
  const me = await requireUser('/organizador/usuarios')
  if (!hasRole(me, 'organizador')) notFound()

  const params = await searchParams
  const rawQuery = typeof params.q === 'string' ? params.q : ''
  // Se sacan caracteres que tienen significado en los filtros de la API.
  const q = rawQuery.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)
  const roleFilter = typeof params.rol === 'string' && ASSIGNABLE.includes(params.rol as AppRole) ? (params.rol as AppRole) : null

  const supabase = await createClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, phone, created_at, user_roles!user_roles_user_id_fkey(role)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
  if (roleFilter) {
    // Filtrar por rol sin perder los demás roles de cada usuario en el listado.
    const { data: withRole } = await supabase.from('user_roles').select('user_id').eq('role', roleFilter)
    query = query.in('id', (withRole ?? []).map((r) => r.user_id))
  }
  const { data: users, error } = await query

  return (
    <div className="page wide">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Usuarios</h1>
      <OrganizerNav current="usuarios" />

      <form className="search" role="search">
        <input name="q" type="search" className="input" placeholder="Buscar por nombre o email" defaultValue={rawQuery} aria-label="Buscar usuarios" />
        <select name="rol" className="input" defaultValue={roleFilter ?? ''} aria-label="Filtrar por rol">
          <option value="">Todos</option>
          {ASSIGNABLE.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">Buscar</button>
      </form>

      {error && <p className="form-error">No se pudieron cargar los usuarios: {error.message}</p>}
      {users?.length === 0 && (
        <div className="empty">
          <p className="empty-title">Sin resultados</p>
          <p>Probá con otra parte del nombre o del email.</p>
        </div>
      )}

      <ul className="list admin-grid">
        {users?.map((u) => {
          const roles = new Set(u.user_roles.map((r) => r.role))
          return (
            <li key={u.id} className="card user-card">
              <div>
                <p className="card-title">{u.full_name || 'Sin nombre'}</p>
                <p className="muted small">{[u.email, u.phone].filter(Boolean).join(' · ')}</p>
                <Link href={`/organizador/puntos/${u.id}`} className="link-hint">Puntos →</Link>
              </div>
              <div className="role-toggles" aria-label={`Roles de ${u.full_name}`}>
                {ASSIGNABLE.map((role) => {
                  const active = roles.has(role)
                  const locked = u.id === me.id && role === 'organizador'
                  return (
                    <ActionForm key={role} action={toggleRole} success={`${ROLE_LABELS[role]}: ${active ? 'quitado' : 'asignado'} a ${u.full_name || 'este usuario'}`}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="role" value={role} />
                      <input type="hidden" name="enable" value={active ? '0' : '1'} />
                      <button
                        type="submit"
                        className={`role-toggle${active ? ' is-on' : ''}`}
                        aria-pressed={active}
                        disabled={locked}
                        title={locked ? 'No podés quitarte tu propio rol de organizador' : undefined}
                      >
                        {active ? '✓ ' : '+ '}
                        {ROLE_LABELS[role]}
                      </button>
                    </ActionForm>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
      {users && users.length === 50 && <p className="muted small">Se muestran los primeros 50. Buscá para encontrar a alguien en particular.</p>}
    </div>
  )
}
