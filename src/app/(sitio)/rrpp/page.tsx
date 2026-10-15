import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { flyerUrl, upcomingSince } from '@/lib/events'
import { firstName, formatShortDay, formatTime } from '@/lib/format'
import { getMyRanking } from '@/lib/ranking'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Panel RRPP' }

export default function RrppPage() {
  return (
    <Suspense fallback={<PageLoading label="Cargando tus fechas…" />}>
      <RrppHome />
    </Suspense>
  )
}

async function RrppHome() {
  const user = await requireUser('/rrpp')
  if (!hasRole(user, 'rrpp')) notFound()

  const supabase = await createClient()
  const [{ data: events }, { data: statuses }, me] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, starts_at, flyer_path')
      .eq('status', 'publicado')
      .gte('starts_at', upcomingSince())
      .order('starts_at', { ascending: true }),
    supabase.rpc('rrpp_event_status'),
    getMyRanking(),
  ])
  const statusByEvent = new Map((statuses ?? []).map((s) => [s.event_id, s]))
  const manager = statuses?.find((s) => s.manager_name)?.manager_name

  return (
    <div className="page">
      <p className="kicker">Panel RRPP</p>
      <h1 className="page-title">Hola, {firstName(user.fullName) || 'RRPP'}</h1>
      <p className="muted">
        En cada fecha tenés QR sin cargo (uno es el tuyo, intransferible). Se habilitan cuando hacés la primera difusión.
        Hay un tope total por fecha: cuando se llega, nadie puede regalar más.
        {manager ? ` Tu organizador es ${manager}.` : ''}
      </p>

      {me && (
        <Link href="/ranking?liga=rrpp" className="card link-card rrpp-rank">
          <span className="rrpp-rank-stat">
            <span className="my-rank-label">Ranking RRPP</span>
            <span className="my-rank-value">{me.position ? `#${me.position}` : '–'}</span>
          </span>
          <span className="rrpp-rank-stat">
            <span className="my-rank-label">Noches</span>
            <span className="my-rank-value">{me.attendances}</span>
          </span>
          <span className="rrpp-rank-stat">
            <span className="my-rank-label">Puntos</span>
            <span className="my-rank-value">{me.points}</span>
          </span>
        </Link>
      )}

      {!events?.length ? (
        <div className="empty">
          <p className="empty-title">No hay fechas publicadas</p>
          <p>Cuando se publique la próxima, la vas a ver acá.</p>
        </div>
      ) : (
        <ul className="list">
          {events.map((event) => {
            const status = statusByEvent.get(event.id)
            const flyer = flyerUrl(event.flyer_path)
            const enabled = !!status?.enabled
            const left = status ? Math.max(0, status.quota - status.used) : 0
            const capLeft = status?.cap != null ? Math.max(0, status.cap - status.cap_used) : null
            const pct = status?.quota ? Math.min(100, Math.round((status.used / status.quota) * 100)) : 0
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
                      {enabled && status ? (
                        <>
                          <p className="quota-text">
                            Te quedan <strong>{left}</strong> de {status.quota}
                            {capLeft !== null ? ` · ${capLeft === 0 ? 'tope alcanzado' : `quedan ${capLeft} en total`}` : ''}
                          </p>
                          <span className="quota-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                        </>
                      ) : (
                        <span className="pill pill-muted">Esperando habilitación</span>
                      )}
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
