import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { PRIZE_POSITIONS, type League } from '@/lib/ranking'
import { createClient } from '@/lib/supabase/server'
import { OrganizerNav } from '../OrganizerNav'

export const metadata: Metadata = { title: 'Puntos' }

export default function PointsAdminPage({ searchParams }: PageProps<'/organizador/puntos'>) {
  return (
    <Suspense fallback={<PageLoading label="Cargando el ranking…" />}>
      <PointsAdmin searchParams={searchParams} />
    </Suspense>
  )
}

async function PointsAdmin({ searchParams }: { searchParams: PageProps<'/organizador/puntos'>['searchParams'] }) {
  const user = await requireUser('/organizador/puntos')
  if (!hasRole(user, 'organizador')) notFound()

  const params = await searchParams
  const league: League = params.liga === 'rrpp' ? 'rrpp' : 'clientes'
  const supabase = await createClient()
  const { data: seasons } = await supabase.from('seasons').select('id, name, is_current').order('starts_on', { ascending: false })
  const season = seasons?.find((s) => s.id === params.temporada) ?? seasons?.find((s) => s.is_current) ?? seasons?.[0]

  const { data: rows, error } = season
    ? await supabase.rpc('admin_season_ranking', { _season_id: season.id, _league: league })
    : { data: [], error: null }

  const link = (next: { temporada?: string; liga?: League }) => {
    const q = new URLSearchParams()
    const t = next.temporada ?? season?.id
    const l = next.liga ?? league
    if (t && !(seasons?.find((s) => s.id === t)?.is_current)) q.set('temporada', t)
    if (l === 'rrpp') q.set('liga', 'rrpp')
    const qs = q.toString()
    return `/organizador/puntos${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="page">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Puntos</h1>
      <OrganizerNav current="puntos" />
      <p className="muted">
        Cada ingreso validado en la puerta suma los puntos del evento (10 por defecto; se cambia al editar cada evento).
        Tocá a alguien para ver sus movimientos o cargarle un premio o un ajuste.
      </p>

      {!season ? (
        <div className="empty">
          <p className="empty-title">No hay temporadas</p>
          <p>Los puntos se cuentan por temporada.</p>
          <Link href="/organizador/temporadas" className="btn btn-primary">Crear temporada</Link>
        </div>
      ) : (
        <>
          {seasons && seasons.length > 1 && (
            <ul className="chips" aria-label="Temporada">
              {seasons.map((s) => (
                <li key={s.id}>
                  <Link href={link({ temporada: s.id })} className="chip chip-link" aria-current={s.id === season.id ? 'page' : undefined}>
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <nav className="subnav" aria-label="Liga">
            <Link href={link({ liga: 'clientes' })} className="subnav-link" aria-current={league === 'clientes' ? 'page' : undefined}>Clientes</Link>
            <Link href={link({ liga: 'rrpp' })} className="subnav-link" aria-current={league === 'rrpp' ? 'page' : undefined}>RRPP</Link>
          </nav>

          {error && <p className="form-error">No se pudo cargar el ranking: {error.message}</p>}

          {rows && rows.length === 0 ? (
            <div className="empty">
              <p className="empty-title">Nadie sumó puntos en {season.name}</p>
              <p>Se suman solos cuando la puerta valida un ingreso de alguien con cuenta.</p>
            </div>
          ) : (
            <ol className="list">
              {rows?.map((r) => (
                <li key={r.user_id}>
                  <Link href={`/organizador/puntos/${r.user_id}?temporada=${season.id}`} className={`card link-card admin-rank${r.pos <= PRIZE_POSITIONS ? ' is-prize' : ''}`}>
                    <span className="ranking-pos">{r.pos}</span>
                    <span className="admin-rank-info">
                      <span className="card-title">{r.full_name || 'Sin nombre'}</span>
                      <span className="muted small">
                        {[r.email, r.phone, `${r.attendances} ${r.attendances === 1 ? 'noche' : 'noches'}`].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="ranking-points">
                      {r.points}
                      <small> pts</small>
                    </span>
                  </Link>
                  {r.pos === PRIZE_POSITIONS && rows.length > PRIZE_POSITIONS && <p className="ranking-cut">Top {PRIZE_POSITIONS} · premio ↑</p>}
                </li>
              ))}
            </ol>
          )}
          <p className="muted small">
            Para cargarle puntos a alguien que todavía no está en el ranking, buscalo en{' '}
            <Link href="/organizador/usuarios">Usuarios</Link> y tocá “Puntos”.
          </p>
        </>
      )}
    </div>
  )
}
