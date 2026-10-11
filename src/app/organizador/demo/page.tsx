import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { NoAccess, PageLoading } from '@/components/PageStates'
import { SubmitButton } from '@/components/SubmitButton'
import { DEMO_EVENTS, DEMO_SLUGS } from '@/demo/events'
import { hasRole, requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadDemoEvents, removeDemoEvents } from './actions'

export const metadata: Metadata = { title: 'Fechas de ejemplo' }

export default function DemoPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Demo />
    </Suspense>
  )
}

async function Demo() {
  const user = await requireUser('/organizador/demo')
  if (!hasRole(user, 'organizador')) return <NoAccess />

  const supabase = await createClient()
  const { count } = await supabase.from('events').select('id', { count: 'exact', head: true }).in('slug', DEMO_SLUGS)
  const loaded = count ?? 0

  return (
    <div className="page">
      <Link href="/organizador" className="back-link">← Eventos</Link>
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Fechas de ejemplo</h1>
      <p className="muted">
        Carga {DEMO_EVENTS.length} fechas publicadas con los flyers de la temporada pasada, en los viernes del verano 2027,
        para ver la web como la vería un cliente. Se pueden borrar cuando quieras sin tocar los eventos reales.
      </p>
      <ul className="list">
        {DEMO_EVENTS.map((e) => (
          <li key={e.slug} className="card row">
            <p className="card-title">{e.name}</p>
            <span className="muted small">{e.date.split('-').reverse().join('/')}</span>
          </li>
        ))}
      </ul>
      {loaded < DEMO_EVENTS.length && (
        <form action={loadDemoEvents}>
          <SubmitButton pendingText="Subiendo flyers y creando fechas…">Cargar fechas de ejemplo</SubmitButton>
        </form>
      )}
      {loaded > 0 && (
        <form action={removeDemoEvents}>
          <ConfirmSubmit message="¿Borrar las fechas de ejemplo? También se borran sus invitaciones." className="btn btn-danger btn-block">
            Borrar fechas de ejemplo ({loaded})
          </ConfirmSubmit>
        </form>
      )}
    </div>
  )
}
