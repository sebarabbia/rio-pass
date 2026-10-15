import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ActionForm } from '@/components/ActionForm'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { getOrganizers } from '@/lib/organizer'
import { createClient } from '@/lib/supabase/server'
import { OrganizerNav } from '../OrganizerNav'
import { removeRrpp, setRrppManager } from './actions'
import { BulkRrppForm } from './BulkRrppForm'

export const metadata: Metadata = { title: 'RRPP' }

type Props = PageProps<'/organizador/rrpp'>

export default function RrppDirectoryPage(props: Props) {
  return (
    <Suspense fallback={<PageLoading label="Cargando RRPP…" />}>
      <RrppDirectory {...props} />
    </Suspense>
  )
}

async function RrppDirectory({ searchParams }: Props) {
  const me = await requireUser('/organizador/rrpp')
  if (!hasRole(me, 'organizador')) notFound()

  const params = await searchParams
  // Por defecto, cada organizador ve su grupo; puede ver todos o los de otro.
  const view = typeof params.ver === 'string' ? params.ver : 'mios'
  const rawQ = typeof params.q === 'string' ? params.q : ''
  const q = rawQ.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)

  const supabase = await createClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, phone, manager_id, user_roles!user_roles_user_id_fkey!inner(role)')
    .eq('user_roles.role', 'rrpp')
    .order('full_name')
    .limit(400)
  if (view === 'mios') query = query.eq('manager_id', me.id)
  else if (view === 'sin') query = query.is('manager_id', null)
  else if (/^[0-9a-f-]{36}$/.test(view)) query = query.eq('manager_id', view)
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)

  const [{ data: rrpps, error }, organizers, { count: total }] = await Promise.all([
    query,
    getOrganizers(supabase),
    supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'rrpp'),
  ])
  const orgName = new Map(organizers.map((o) => [o.id, o.name]))

  return (
    <div className="page wide">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">RRPP</h1>
      <OrganizerNav current="rrpp" />
      <p className="muted">
        {total ?? 0} RRPP en total. Cada uno está a cargo de un organizador. Los QR de cada fecha se habilitan desde
        Eventos → RRPP, después de la primera difusión.
      </p>

      <details className="card bulk-details">
        <summary className="card-title">+ Cargar RRPP</summary>
        <BulkRrppForm organizers={organizers} me={me.id} />
      </details>

      <form className="search" role="search">
        <input name="q" type="search" className="input" placeholder="Buscar por nombre, email o celular" defaultValue={rawQ} aria-label="Buscar RRPP" />
        <select name="ver" className="input" defaultValue={view} aria-label="Qué RRPP ver">
          <option value="mios">Mis RRPP</option>
          <option value="todos">Todos</option>
          <option value="sin">Sin organizador</option>
          {organizers
            .filter((o) => o.id !== me.id)
            .map((o) => (
              <option key={o.id} value={o.id}>De {o.name}</option>
            ))}
        </select>
        <button type="submit" className="btn btn-secondary">Ver</button>
      </form>

      {error && <p className="form-error">No se pudieron cargar los RRPP: {error.message}</p>}
      {rrpps && rrpps.length === 0 && (
        <div className="empty">
          <p className="empty-title">{view === 'mios' ? 'Todavía no tenés RRPP a cargo' : 'No hay RRPP con ese filtro'}</p>
          <p>Cargalos con “+ Cargar RRPP” o mirá los de todos.</p>
        </div>
      )}

      <ul className="list admin-grid">
        {rrpps?.map((r) => (
          <li key={r.id} className="card rrpp-row">
            <div>
              <p className="card-title">{r.full_name || 'Sin nombre'}</p>
              <p className="muted small">{[r.email, r.phone].filter(Boolean).join(' · ')}</p>
              <p className="muted small">A cargo de {r.manager_id ? (orgName.get(r.manager_id) ?? 'otro organizador') : 'nadie'}</p>
            </div>
            <ActionForm action={setRrppManager} success={`Organizador de ${r.full_name || 'este RRPP'} actualizado`} className="assign-row">
              <input type="hidden" name="id" value={r.id} />
              <select name="managerId" className="input" defaultValue={r.manager_id ?? ''} aria-label={`Organizador de ${r.full_name}`}>
                <option value="">Sin organizador</option>
                {organizers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-secondary btn-sm">Cambiar</button>
            </ActionForm>
            <ActionForm action={removeRrpp} success={`${r.full_name || 'Esa persona'} ya no es RRPP`}>
              <input type="hidden" name="id" value={r.id} />
              <ConfirmSubmit message={`¿Sacar a ${r.full_name || 'esta persona'} de RRPP? Queda como cliente: sus QR y puntos siguen.`} className="btn btn-ghost btn-sm">
                Quitar de RRPP
              </ConfirmSubmit>
            </ActionForm>
          </li>
        ))}
      </ul>
      <p className="muted small">
        ¿Alguien no puede entrar? Pasale este link para que elija su contraseña: <Link href="/activar">/activar</Link>
      </p>
    </div>
  )
}
