import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ActionForm } from '@/components/ActionForm'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { firstName, formatShortDay, formatTime } from '@/lib/format'
import { getOrganizers } from '@/lib/organizer'
import { whatsappLink } from '@/lib/share'
import { getOrigin } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { setRrppAccess, setRrppExtra } from './actions'

export const metadata: Metadata = { title: 'RRPP de la fecha' }

type Props = PageProps<'/organizador/eventos/[id]/rrpp'>
const STATES = { todos: 'Todos', sin: 'Sin habilitar', habilitados: 'Habilitados' } as const

export default function EventRrppPage(props: Props) {
  return (
    <Suspense fallback={<PageLoading label="Cargando RRPP…" />}>
      <EventRrpp {...props} />
    </Suspense>
  )
}

async function EventRrpp({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const me = await requireUser(`/organizador/eventos/${id}/rrpp`)
  if (!hasRole(me, 'organizador')) notFound()

  const view = typeof query.ver === 'string' ? query.ver : 'mios'
  const state = (typeof query.estado === 'string' && query.estado in STATES ? query.estado : 'todos') as keyof typeof STATES
  const q = (typeof query.q === 'string' ? query.q : '').trim().toLowerCase()

  const supabase = await createClient()
  const [{ data: event }, { data: board, error }, organizers, origin] = await Promise.all([
    supabase.from('events').select('id, name, starts_at, rrpp_invite_quota, rrpp_total_cap').eq('id', id).maybeSingle(),
    supabase.rpc('event_rrpp_board', { _event_id: id }),
    getOrganizers(supabase),
    getOrigin(),
  ])
  if (!event) notFound()

  const all = board ?? []
  const capUsed = all.reduce((sum, r) => sum + r.issued, 0)
  const enabledCount = all.filter((r) => r.enabled).length
  const rows = all.filter((r) => {
    if (view === 'mios' && r.manager_id !== me.id) return false
    if (view === 'sin' && r.manager_id) return false
    if (/^[0-9a-f-]{36}$/.test(view) && r.manager_id !== view) return false
    if (state === 'sin' && r.enabled) return false
    if (state === 'habilitados' && !r.enabled) return false
    if (q && ![r.full_name, r.email, r.phone].some((v) => v?.toLowerCase().includes(q))) return false
    return true
  })
  const pending = rows.filter((r) => !r.enabled)
  const cap = event.rrpp_total_cap
  const capPct = cap ? Math.min(100, Math.round((capUsed / cap) * 100)) : 0
  const when = `${formatShortDay(event.starts_at)} ${formatTime(event.starts_at)} h`

  return (
    <div className="page wide">
      <Link href="/organizador" className="back-link">← Eventos</Link>
      <p className="kicker">{when}</p>
      <h1 className="page-title">RRPP · {event.name}</h1>

      <div className="card cap-card">
        <p className="cap-line">
          <strong>{capUsed}</strong> {cap != null ? `de ${cap}` : ''} QR de RRPP entregados
          <span className="muted"> · {enabledCount} de {all.length} RRPP habilitados</span>
        </p>
        {cap != null && <span className="quota-bar" aria-hidden="true"><span style={{ width: `${capPct}%` }} /></span>}
        <p className="muted small">
          Cada RRPP habilitado tiene {event.rrpp_invite_quota} QR (incluye el suyo, que se le crea al habilitarlo). Habilitalos
          después de la primera difusión. El tope y el cupo se cambian editando el evento.{' '}
          <Link href={`/organizador/eventos/${event.id}/invitaciones?origen=rrpp`}>Ver los QR entregados</Link>
        </p>
      </div>

      <form className="search search-wide" role="search">
        <input name="q" type="search" className="input" placeholder="Buscar RRPP" defaultValue={q} aria-label="Buscar RRPP" />
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
        <select name="estado" className="input" defaultValue={state} aria-label="Estado">
          {Object.entries(STATES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">Ver</button>
      </form>

      {pending.length > 0 && (
        <ActionForm action={setRrppAccess} success={`${pending.length} RRPP habilitados`}>
          <input type="hidden" name="eventId" value={event.id} />
          <input type="hidden" name="ids" value={pending.map((r) => r.rrpp_id).join(',')} />
          <input type="hidden" name="enabled" value="1" />
          <ConfirmSubmit message={`¿Habilitar a los ${pending.length} RRPP de la lista? A cada uno se le crea su QR propio.`} className="btn btn-primary btn-block">
            Habilitar a los {pending.length} de la lista
          </ConfirmSubmit>
        </ActionForm>
      )}

      {error && <p className="form-error">No se pudo cargar la lista: {error.message}</p>}
      {rows.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No hay RRPP con ese filtro</p>
          <p>{view === 'mios' ? 'Probá con “Todos” o cargá RRPP en la pestaña RRPP del panel.' : 'Probá con otro filtro.'}</p>
        </div>
      ) : (
        <ul className="list admin-grid">
          {rows.map((r) => {
            const quota = event.rrpp_invite_quota + r.extra
            const notify = r.phone
              ? whatsappLink(
                  r.phone,
                  `¡Hola ${firstName(r.full_name) || ''}! Ya tenés habilitados tus ${quota} QR para ${event.name} (${when}). Entrá a ${origin}/rrpp/${event.id} para regalarlos. Tu QR propio ya está en tu cuenta.`,
                )
              : null
            return (
              <li key={r.rrpp_id} className={`card rrpp-row${r.enabled ? ' is-enabled' : ''}`}>
                <div className="row">
                  <div className="invitation-info">
                    <p className="card-title">{r.full_name || 'Sin nombre'}</p>
                    <p className="muted small">
                      {[r.phone, r.manager_name ? `de ${r.manager_name}` : 'sin organizador'].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`pill ${r.enabled ? 'pill-ok' : 'pill-muted'}`}>{r.enabled ? 'Habilitado' : 'Sin habilitar'}</span>
                </div>
                {r.enabled && (
                  <p className="quota-text">
                    <Link href={`/organizador/eventos/${event.id}/invitaciones?rrpp=${r.rrpp_id}`}>
                      <strong>{r.issued}</strong> de {quota} QR entregados
                    </Link>
                    {r.used > 0 ? ` · ${r.used} ya entraron` : ''}
                    {r.extra > 0 ? ` · +${r.extra} extra` : ''}
                  </p>
                )}
                <div className="invitation-actions">
                  <ActionForm action={setRrppAccess} success={r.enabled ? `${r.full_name} deshabilitado` : `${r.full_name} habilitado`}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="ids" value={r.rrpp_id} />
                    <input type="hidden" name="enabled" value={r.enabled ? '0' : '1'} />
                    {r.enabled ? (
                      <ConfirmSubmit
                        message={`¿Deshabilitar a ${r.full_name}? Se anula su QR propio si no lo usó. Los QR que ya regaló siguen valiendo (podés anularlos en "Ver los QR").`}
                        className="btn btn-ghost btn-sm"
                      >
                        Deshabilitar
                      </ConfirmSubmit>
                    ) : (
                      <button type="submit" className="btn btn-primary btn-sm">Habilitar</button>
                    )}
                  </ActionForm>
                  {r.enabled && (
                    <>
                      <ActionForm action={setRrppExtra} success={`+1 QR para ${r.full_name}`}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="id" value={r.rrpp_id} />
                        <input type="hidden" name="extra" value={r.extra + 1} />
                        <button type="submit" className="btn btn-secondary btn-sm" disabled={r.extra >= 50}>+1 QR</button>
                      </ActionForm>
                      {r.extra > 0 && (
                        <ActionForm action={setRrppExtra} success={`−1 QR para ${r.full_name}`}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="id" value={r.rrpp_id} />
                          <input type="hidden" name="extra" value={r.extra - 1} />
                          <button type="submit" className="btn btn-ghost btn-sm">−1</button>
                        </ActionForm>
                      )}
                      {notify && (
                        <a href={notify} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Avisar</a>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
