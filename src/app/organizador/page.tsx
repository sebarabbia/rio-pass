import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { NoAccess, PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { flyerUrl } from '@/lib/events'
import { formatShortDay, formatTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { setEventStatus } from './actions'
import { DeleteEventButton } from './DeleteEventButton'
import { OrganizerNav } from './OrganizerNav'

export const metadata: Metadata = { title: 'Panel de organizador' }

export default function OrganizerPage() {
  return (
    <Suspense fallback={<PageLoading label="Cargando panel…" />}>
      <Panel />
    </Suspense>
  )
}

const STATUS_LABEL = { borrador: 'Borrador', publicado: 'Publicado', cancelado: 'Cancelado' } as const
const STATUS_PILL = { borrador: 'pill-muted', publicado: 'pill-ok', cancelado: 'pill-bad' } as const

async function Panel() {
  const user = await requireUser('/organizador')
  if (!hasRole(user, 'organizador')) return <NoAccess />

  const supabase = await createClient()
  const { data: events, error } = await supabase
    .from('events')
    .select('id, slug, name, starts_at, status, flyer_path, tickets(count)')
    .order('starts_at', { ascending: false })

  return (
    <div className="page">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Eventos</h1>
      <OrganizerNav current="eventos" />
      <Link href="/organizador/eventos/nuevo" className="btn btn-primary btn-block">+ Nuevo evento</Link>

      {error && <p className="form-error">No se pudieron cargar los eventos: {error.message}</p>}

      {events && events.length === 0 && (
        <div className="empty section-block">
          <p className="empty-title">Todavía no hay eventos</p>
          <p>Creá el primero. Mientras esté en borrador no lo ve nadie; cuando lo publiques aparece en la web.</p>
        </div>
      )}

      <ul className="list section-block">
        {events?.map((event) => {
          const flyer = flyerUrl(event.flyer_path)
          const qrCount = event.tickets[0]?.count ?? 0
          return (
            <li key={event.id} className="card admin-event">
              <div className="admin-event-main">
                <div className="admin-event-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del flyer */}
                  {flyer ? <img src={flyer} alt="" /> : null}
                </div>
                <div className="admin-event-info">
                  <p className="card-title">{event.name}</p>
                  <p className="muted">
                    {formatShortDay(event.starts_at)} · {formatTime(event.starts_at)} h
                  </p>
                  <span className={`pill ${STATUS_PILL[event.status]}`}>{STATUS_LABEL[event.status]}</span>
                </div>
              </div>
              <div className="admin-event-actions">
                <Link href={`/organizador/eventos/${event.id}/invitaciones`} className="btn btn-primary btn-sm">
                  Invitaciones ({qrCount})
                </Link>
                <Link href={`/organizador/eventos/${event.id}`} className="btn btn-secondary btn-sm">Editar</Link>
                <form action={setEventStatus}>
                  <input type="hidden" name="id" value={event.id} />
                  <input type="hidden" name="status" value={event.status === 'publicado' ? 'borrador' : 'publicado'} />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    {event.status === 'publicado' ? 'Despublicar' : 'Publicar'}
                  </button>
                </form>
                {event.status === 'publicado' && (
                  <Link href={`/eventos/${event.slug}`} className="btn btn-ghost btn-sm">Ver</Link>
                )}
                <DeleteEventButton id={event.id} name={event.name} />
              </div>
            </li>
          )
        })}
      </ul>

      <Link href="/organizador/demo" className="btn btn-ghost btn-block section-block">Fechas de ejemplo</Link>

      <div className="card notice">
        <p className="card-title">Próximamente en este panel</p>
        <p className="muted">Validación en la puerta, alta y bloqueo de tarjetas NFC, y estadísticas de asistencia.</p>
      </div>
    </div>
  )
}
