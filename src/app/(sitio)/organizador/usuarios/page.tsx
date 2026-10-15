import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ActionForm } from '@/components/ActionForm'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser, ROLE_LABELS, type AppRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OrganizerNav } from '../OrganizerNav'
import { setProfile } from './actions'

export const metadata: Metadata = { title: 'Usuarios' }

// Cada persona tiene un solo perfil. Todos conservan lo de cliente (QR y puntos).
const PROFILES: AppRole[] = ['cliente', 'rrpp', 'acreditador', 'organizador']
const PROFILE_PILL: Record<string, string> = { cliente: 'pill-muted', rrpp: 'pill-ok', acreditador: 'pill-ok', organizador: 'pill-ok', barra: 'pill-ok' }

export default function UsersPage({ searchParams }: PageProps<'/organizador/usuarios'>) {
  return (
    <Suspense fallback={<PageLoading label="Cargando usuarios…" />}>
      <Users searchParams={searchParams} />
    </Suspense>
  )
}

function profileOf(roles: { role: AppRole }[]): AppRole {
  return roles.find((r) => r.role !== 'cliente')?.role ?? 'cliente'
}

async function Users({ searchParams }: { searchParams: PageProps<'/organizador/usuarios'>['searchParams'] }) {
  const me = await requireUser('/organizador/usuarios')
  if (!hasRole(me, 'organizador')) notFound()

  const params = await searchParams
  const rawQuery = typeof params.q === 'string' ? params.q : ''
  // Se sacan caracteres que tienen significado en los filtros de la API.
  const q = rawQuery.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)
  const profileFilter = typeof params.rol === 'string' && PROFILES.includes(params.rol as AppRole) ? (params.rol as AppRole) : null

  const supabase = await createClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, phone, created_at, user_roles!user_roles_user_id_fkey(role)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
  if (profileFilter === 'cliente') {
    // Clientes = los que no tienen otro perfil.
    const { data: staff } = await supabase.from('user_roles').select('user_id').neq('role', 'cliente')
    const ids = (staff ?? []).map((r) => r.user_id)
    if (ids.length) query = query.not('id', 'in', `(${ids.join(',')})`)
  } else if (profileFilter) {
    const { data: withRole } = await supabase.from('user_roles').select('user_id').eq('role', profileFilter)
    query = query.in('id', (withRole ?? []).map((r) => r.user_id))
  }
  const { data: users, error } = await query

  return (
    <div className="page wide">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Usuarios</h1>
      <OrganizerNav current="usuarios" />
      <p className="muted">
        Cada persona tiene un solo perfil. RRPP, acreditadores y organizadores también ven lo de cliente (sus QR y puntos). Para
        cargar muchos RRPP juntos, usá la pestaña <Link href="/organizador/rrpp">RRPP</Link>.
      </p>

      <form className="search" role="search">
        <input name="q" type="search" className="input" placeholder="Buscar por nombre, email o celular" defaultValue={rawQuery} aria-label="Buscar usuarios" />
        <select name="rol" className="input" defaultValue={profileFilter ?? ''} aria-label="Filtrar por perfil">
          <option value="">Todos</option>
          {PROFILES.map((r) => (
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
          const profile = profileOf(u.user_roles)
          const isMe = u.id === me.id
          return (
            <li key={u.id} className="card user-card">
              <div className="row">
                <div className="invitation-info">
                  <p className="card-title">{u.full_name || 'Sin nombre'}</p>
                  <p className="muted small">{[u.email, u.phone].filter(Boolean).join(' · ')}</p>
                  <Link href={`/organizador/puntos/${u.id}`} className="link-hint">Puntos →</Link>
                </div>
                <span className={`pill ${PROFILE_PILL[profile]}`}>{ROLE_LABELS[profile]}</span>
              </div>
              <ActionForm action={setProfile} success={`${u.full_name || 'Usuario'}: perfil actualizado`} error="No se pudo cambiar el perfil." className="assign-row">
                <input type="hidden" name="userId" value={u.id} />
                <select name="profile" className="input" defaultValue={profile} disabled={isMe} aria-label={`Perfil de ${u.full_name}`}>
                  {PROFILES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn-secondary btn-sm" disabled={isMe} title={isMe ? 'No podés cambiar tu propio perfil' : undefined}>
                  Cambiar
                </button>
              </ActionForm>
            </li>
          )
        })}
      </ul>
      {users && users.length === 50 && <p className="muted small">Se muestran los primeros 50. Buscá para encontrar a alguien en particular.</p>}
    </div>
  )
}
