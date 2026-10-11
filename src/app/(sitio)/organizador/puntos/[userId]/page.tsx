import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { formatShortDay, formatTime } from '@/lib/format'
import { REASON_LABELS } from '@/lib/ranking'
import { createClient } from '@/lib/supabase/server'
import { OrganizerNav } from '../../OrganizerNav'
import { AdjustPointsForm } from './AdjustPointsForm'

export const metadata: Metadata = { title: 'Puntos de una persona' }

const UUID_RE = /^[0-9a-f-]{36}$/

export default function UserPointsPage(props: PageProps<'/organizador/puntos/[userId]'>) {
  return (
    <Suspense fallback={<PageLoading />}>
      <UserPoints {...props} />
    </Suspense>
  )
}

async function UserPoints({ params, searchParams }: PageProps<'/organizador/puntos/[userId]'>) {
  const me = await requireUser('/organizador/puntos')
  if (!hasRole(me, 'organizador')) notFound()

  const [{ userId }, query] = await Promise.all([params, searchParams])
  if (!UUID_RE.test(userId)) notFound()

  const supabase = await createClient()
  const [{ data: person }, { data: seasons }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone').eq('id', userId).maybeSingle(),
    supabase.from('seasons').select('id, name, is_current').order('starts_on', { ascending: false }),
  ])
  if (!person) notFound()
  const season = seasons?.find((s) => s.id === query.temporada) ?? seasons?.find((s) => s.is_current) ?? seasons?.[0]

  const { data: movements } = season
    ? await supabase
        .from('points_ledger')
        .select('id, points, reason, note, created_at, events(name), creator:profiles!points_ledger_created_by_fkey(full_name)')
        .eq('user_id', userId)
        .eq('season_id', season.id)
        .order('created_at', { ascending: false })
    : { data: [] }
  const total = (movements ?? []).reduce((sum, m) => sum + m.points, 0)

  return (
    <div className="page">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">{person.full_name || 'Sin nombre'}</h1>
      <OrganizerNav current="puntos" />
      <Link href={`/organizador/puntos${season && !season.is_current ? `?temporada=${season.id}` : ''}`} className="back-link">← Volver al ranking</Link>
      <p className="muted small">{[person.email, person.phone].filter(Boolean).join(' · ')}</p>

      {!season ? (
        <div className="empty">
          <p className="empty-title">No hay temporadas</p>
          <Link href="/organizador/temporadas" className="btn btn-primary">Crear temporada</Link>
        </div>
      ) : (
        <>
          {seasons && seasons.length > 1 && (
            <ul className="chips" aria-label="Temporada">
              {seasons.map((s) => (
                <li key={s.id}>
                  <Link href={`/organizador/puntos/${userId}?temporada=${s.id}`} className="chip chip-link" aria-current={s.id === season.id ? 'page' : undefined}>
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="card points-card">
            <p className="points-value">{total}</p>
            <p className="points-label">puntos · {season.name}</p>
          </div>

          <AdjustPointsForm userId={userId} seasonId={season.id} seasonName={season.name} />

          <section aria-labelledby="movs">
            <h2 id="movs" className="block-title">Movimientos</h2>
            {movements && movements.length > 0 ? (
              <ul className="list movements">
                {movements.map((m) => (
                  <li key={m.id} className="movement">
                    <span className={`movement-points${m.points < 0 ? ' is-negative' : ''}`}>{m.points > 0 ? `+${m.points}` : m.points}</span>
                    <span className="movement-text">
                      {REASON_LABELS[m.reason]}
                      {m.events?.name ? ` · ${m.events.name}` : ''}
                      {m.note ? ` · ${m.note}` : ''}
                      {m.creator?.full_name ? <span className="muted small"> · por {m.creator.full_name}</span> : null}
                    </span>
                    <span className="movement-date">
                      {formatShortDay(m.created_at)} {formatTime(m.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sin movimientos en esta temporada.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
