import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OrganizerNav } from '../OrganizerNav'
import { setCurrentSeason } from './actions'
import { SeasonForm } from './SeasonForm'

export const metadata: Metadata = { title: 'Temporadas' }

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`))

export default function SeasonsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Seasons />
    </Suspense>
  )
}

async function Seasons() {
  const user = await requireUser('/organizador/temporadas')
  if (!hasRole(user, 'organizador')) notFound()

  const supabase = await createClient()
  const { data: seasons } = await supabase.from('seasons').select('id, name, starts_on, ends_on, is_current').order('starts_on', { ascending: false })

  return (
    <div className="page">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Temporadas</h1>
      <OrganizerNav current="temporadas" />
      <p className="muted">
        Los puntos y el ranking se cuentan por temporada. Los eventos nuevos se asignan a la temporada actual.
      </p>

      {seasons?.length ? (
        <ul className="list">
          {seasons.map((s) => (
            <li key={s.id} className="card row">
              <div>
                <p className="card-title">{s.name}</p>
                <p className="muted small">{formatDate(s.starts_on)} – {formatDate(s.ends_on)}</p>
              </div>
              {s.is_current ? (
                <span className="pill pill-ok">Actual</span>
              ) : (
                <form action={setCurrentSeason}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="btn btn-secondary btn-sm">Marcar actual</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <p className="empty-title">Todavía no hay temporadas</p>
          <p>Creá la de este verano para empezar a contar puntos.</p>
        </div>
      )}

      <SeasonForm />
    </div>
  )
}
