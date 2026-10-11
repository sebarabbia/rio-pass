import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { NoAccess, PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { flyerUrl, upcomingSince } from '@/lib/events'
import { firstName, formatShortDay, formatTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Panel RRPP' }

export default function RrppPage() {
  return (
    <Suspense fallback={<PageLoading label="Cargando tus eventos…" />}>
      <RrppHome />
    </Suspense>
  )
}

async function RrppHome() {
  const user = await requireUser('/rrpp')
  if (!hasRole(user, 'rrpp')) return <NoAccess role="RRPP" />

  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('id, name, starts_at, flyer_path, rrpp_invite_quota')
    .eq('status', 'publicado')
    .gte('starts_at', upcomingSince())
    .order('starts_at', { ascending: true })

  // Cuántas invitaciones (no anuladas) emitió este RRPP en cada evento.
  const used = new Map<string, number>()
  if (events?.length) {
    const { data: mine } = await supabase
      .from('tickets')
      .select('event_id')
      .eq('issued_by', user.id)
      .eq('kind', 'invitacion')
      .neq('status', 'anulado')
      .in('event_id', events.map((e) => e.id))
    for (const t of mine ?? []) used.set(t.event_id, (used.get(t.event_id) ?? 0) + 1)
  }

  return (
    <div className="page">
      <p className="kicker">Panel RRPP</p>
      <h1 className="page-title">Hola, {firstName(user.fullName) || 'RRPP'}</h1>
      <p className="muted">Elegí una fecha para generar QR sin cargo y mandarlos por WhatsApp. Cada fecha tiene un cupo por RRPP.</p>

      {!events?.length ? (
        <div className="empty">
          <p className="empty-title">No hay fechas publicadas</p>
          <p>Cuando se publique la próxima, vas a poder generar invitaciones desde acá.</p>
        </div>
      ) : (
        <ul className="list">
          {events.map((event) => {
            const count = used.get(event.id) ?? 0
            const flyer = flyerUrl(event.flyer_path)
            const pct = event.rrpp_invite_quota ? Math.min(100, Math.round((count / event.rrpp_invite_quota) * 100)) : 100
            return (
              <li key={event.id}>
                <Link href={`/rrpp/${event.id}`} className="card admin-event link-card">
                  <div className="admin-event-main">
                    <div className="admin-event-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del flyer */}
                      {flyer ? <img src={flyer} alt="" /> : null}
                    </div>
                    <div className="admin-event-info">
                      <p className="card-title">{event.name}</p>
                      <p className="muted">{formatShortDay(event.starts_at)} · {formatTime(event.starts_at)} h</p>
                      <p className="quota-text">
                        <strong>{count}</strong> de {event.rrpp_invite_quota} QR usados
                      </p>
                      <span className="quota-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
