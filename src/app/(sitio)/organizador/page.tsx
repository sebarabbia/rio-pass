import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { ActionForm } from '@/components/ActionForm'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { flyerUrl, upcomingSince } from '@/lib/events'
import { formatShortDay, formatTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { setEventStatus } from './actions'
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

type PanelEvent = {
  id: string
  slug: string
  name: string
  starts_at: string
  status: keyof typeof STATUS_LABEL
  flyer_path: string | null
  issued: { count: number }[]
  used: { count: number }[]
  entries: { count: number }[]
}

async function Panel() {
  const user = await requireUser('/organizador')
  if (!hasRole(user, 'organizador')) notFound()

  const supabase = await createClient()
  // Números de cada noche: QR emitidos (sin anulados), QR usados e ingresos validados en la puerta.
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, name, starts_at, status, flyer_path, issued:tickets(count), used:tickets(count), entries:access_scans(count)')
    .neq('issued.status', 'anulado')
    .eq('used.status', 'usado')
    .eq('entries.result', 'permitido')
    .order('starts_at', { ascending: true })
  const events = (data ?? []) as unknown as PanelEvent[]

  const since = upcomingSince()
  const upcoming = events.filter((e) => e.starts_at >= since)
  const past = events.filter((e) => e.starts_at < since).reverse()

  return (
    <div className="page wide">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Eventos</h1>
      <OrganizerNav current="eventos" />
      <Link href="/organizador/eventos/nuevo" className="btn btn-primary btn-block">+ Nuevo evento</Link>

      {error && <p className="form-error">No se pudieron cargar los eventos: {error.message}</p>}

      <section aria-labelledby="h-proximas">
        <h2 id="h-proximas" className="block-title">Próximas fechas ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No hay fechas próximas</p>
            <p>Creá la próxima. Mientras esté en borrador no la ve nadie; cuando la publiques aparece en la web.</p>
          </div>
        ) : (
          <ul className="list admin-grid">
            {upcoming.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <details className="past-events">
          <summary className="block-title">Fechas anteriores ({past.length})</summary>
          <ul className="list admin-grid">
            {past.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function EventItem({ event }: { event: PanelEvent }) {
  const flyer = flyerUrl(event.flyer_path)
  const published = event.status === 'publicado'
  const stats = [
    { label: 'Emitidos', value: event.issued[0]?.count ?? 0, hint: 'QR emitidos (sin contar anulados)' },
    { label: 'Usados', value: event.used[0]?.count ?? 0, hint: 'QR que ya entraron' },
    { label: 'Ingresos', value: event.entries[0]?.count ?? 0, hint: 'Ingresos validados en la puerta (QR y tarjetas)' },
  ]
  return (
    <li className="card admin-event">
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
      <dl className="event-stats">
        {stats.map((s) => (
          <div key={s.label} title={s.hint}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="admin-event-actions">
        <Link href={`/organizador/eventos/${event.id}/rrpp`} className="btn btn-primary btn-sm">RRPP</Link>
        <Link href={`/organizador/eventos/${event.id}/invitaciones`} className="btn btn-secondary btn-sm">QR</Link>
        <Link href={`/organizador/eventos/${event.id}/ventas`} className="btn btn-secondary btn-sm">Ventas</Link>
        <Link href={`/organizador/eventos/${event.id}`} className="btn btn-secondary btn-sm">Editar</Link>
        <ActionForm action={setEventStatus} success={published ? `${event.name} pasó a borrador` : `${event.name} ya está en la web`}>
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="status" value={published ? 'borrador' : 'publicado'} />
          <button type="submit" className="btn btn-secondary btn-sm">{published ? 'Despublicar' : 'Publicar'}</button>
        </ActionForm>
        {published && (
          <Link href={`/eventos/${event.slug}`} className="btn btn-ghost btn-sm">Ver en la web</Link>
        )}
      </div>
    </li>
  )
}
