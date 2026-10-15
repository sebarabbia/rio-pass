import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { RankingList } from '@/components/RankingList'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { getMyRanking, getRanking, PRIZE_POSITIONS, standingMessage, type League, type RankingRow } from '@/lib/ranking'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Ranking',
  description: 'El ranking de la temporada de Rio: sumá puntos cada noche que venís. El top 10 se lleva premio.',
}

export default function RankingPage({ searchParams }: PageProps<'/ranking'>) {
  return (
    <Suspense fallback={<PageLoading label="Cargando el ranking…" />}>
      <Ranking searchParams={searchParams} />
    </Suspense>
  )
}

async function Ranking({ searchParams }: { searchParams: PageProps<'/ranking'>['searchParams'] }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  // La liga de RRPP es interna: un cliente no ve la pestaña ni puede abrirla por URL.
  const staff = !!user && (hasRole(user, 'rrpp') || hasRole(user, 'organizador'))
  const league: League = staff && params.liga === 'rrpp' ? 'rrpp' : 'clientes'

  const supabase = await createClient()
  const [{ data: season }, rows, me] = await Promise.all([
    supabase.from('seasons').select('name').eq('is_current', true).maybeSingle(),
    getRanking(league),
    user ? getMyRanking() : null,
  ])

  return (
    <div className="page">
      <p className="kicker">{season ? `Ranking · ${season.name}` : 'Ranking'}</p>
      <h1 className="page-title">
        {league === 'rrpp' ? (
          <>
            Ranking de <em>RRPP</em>
          </>
        ) : (
          <>
            Top {PRIZE_POSITIONS} de la <em>temporada</em>
          </>
        )}
      </h1>
      <p className="muted page-lead">
        {league === 'rrpp'
          ? 'Las noches que vino cada RRPP esta temporada. Es interno: los clientes no lo ven.'
          : `Cada noche que venís a Rio sumás puntos. Al final de la temporada, el top ${PRIZE_POSITIONS} se lleva premio.`}
      </p>

      {staff && (
        <nav className="subnav" aria-label="Liga">
          <Link href="/ranking" className="subnav-link" aria-current={league === 'clientes' ? 'page' : undefined}>Clientes</Link>
          <Link href="/ranking?liga=rrpp" className="subnav-link" aria-current={league === 'rrpp' ? 'page' : undefined}>RRPP</Link>
        </nav>
      )}

      {!user ? (
        <div className="card my-rank-cta">
          <p>Ingresá para ver tu puesto y tus puntos.</p>
          <div className="my-rank-actions">
            <Link href="/ingresar?next=%2Franking" className="btn btn-primary btn-sm">Ingresar</Link>
            <Link href="/registro?next=%2Franking" className="btn btn-secondary btn-sm">Crear cuenta</Link>
          </div>
        </div>
      ) : (
        me &&
        me.league === league && (
          <div className="card my-rank">
            <div className="my-rank-stat">
              <span className="my-rank-label">Tu puesto</span>
              <span className="my-rank-value">{me.position ? `#${me.position}` : '–'}</span>
            </div>
            <div className="my-rank-stat">
              <span className="my-rank-label">Tus puntos</span>
              <span className="my-rank-value">{me.points}</span>
            </div>
            <p className="my-rank-msg">{standingMessage(me)}</p>
          </div>
        )
      )}

      {!season ? (
        <div className="empty">
          <p className="empty-title">El ranking arranca con la temporada</p>
          <p>Cuando empiece, cada noche que vengas vas a sumar puntos.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Todavía nadie sumó puntos</p>
          <p>El ranking se arma con los ingresos de cada noche. Vení a la próxima y arrancá arriba.</p>
        </div>
      ) : (
        <>
          <Podium rows={rows.slice(0, 3)} />
          {rows.length > 3 && <RankingList rows={rows.slice(3)} />}
          <p className="muted small">A igual puntaje, va primero quien llegó antes a ese total.</p>
        </>
      )}
    </div>
  )
}

/** Los tres primeros, en grande. */
function Podium({ rows }: { rows: RankingRow[] }) {
  return (
    <ol className="podium">
      {rows.map((row) => (
        <li key={row.pos} className={`podium-item is-${row.pos}${row.is_me ? ' is-me' : ''}`}>
          <span className="podium-pos">{row.pos}</span>
          <span className="podium-name">
            {row.name}
            {row.is_me && <span className="ranking-you">Vos</span>}
          </span>
          <span className="podium-points">
            {row.points} <small>pts</small>
          </span>
        </li>
      ))}
    </ol>
  )
}
