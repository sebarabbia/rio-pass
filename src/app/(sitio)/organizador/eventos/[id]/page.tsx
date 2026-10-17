import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { flyerUrl } from '@/lib/events'
import { toLocalInputs } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { DeleteEventButton } from '../../DeleteEventButton'
import { EventForm } from '../../EventForm'

export const metadata: Metadata = { title: 'Editar evento' }

export default function EditEventPage(props: PageProps<'/organizador/eventos/[id]'>) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditEvent {...props} />
    </Suspense>
  )
}

const DELETE_ERRORS: Record<string, string> = {
  ventas: 'Este evento tiene compras online: no se puede borrar. Pasalo a "Cancelado" (no se ve en la web) y devolvé las compras desde Ventas si hace falta.',
  borrar: 'No se pudo borrar el evento. Probá pasarlo a "Cancelado".',
}

async function EditEvent({ params, searchParams }: PageProps<'/organizador/eventos/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const deleteError = typeof query.error === 'string' ? DELETE_ERRORS[query.error] : undefined
  const user = await requireUser(`/organizador/eventos/${id}`)
  if (!hasRole(user, 'organizador')) notFound()

  const supabase = await createClient()
  const [{ data: event }, { data: seasons }] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, description, venue, starts_at, ends_at, status, flyer_path, rrpp_invite_quota, rrpp_total_cap, attendance_points, season_id, ticket_types(name, sort_order, is_active)')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('seasons').select('id, name, is_current').order('starts_on', { ascending: false }),
  ])
  if (!event) notFound()

  const start = toLocalInputs(event.starts_at)
  const sectors = event.ticket_types
    .filter((t) => t.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => t.name)
    .join(', ')

  return (
    <div className="page">
      <Link href="/organizador" className="back-link">← Eventos</Link>
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Editar evento</h1>
      <Link href={`/organizador/eventos/${event.id}/invitaciones`} className="btn btn-secondary btn-block">
        QR entregados de este evento
      </Link>
      <Link href={`/organizador/eventos/${event.id}/rrpp`} className="btn btn-secondary btn-block">
        Habilitar RRPP de esta fecha
      </Link>
      <EventForm
        seasons={seasons ?? []}
        initial={{
          id: event.id,
          name: event.name,
          date: start.date,
          startTime: start.time,
          endTime: event.ends_at ? toLocalInputs(event.ends_at).time : '',
          description: event.description,
          status: event.status,
          flyerUrl: flyerUrl(event.flyer_path),
          venue: event.venue,
          sectors,
          quota: event.rrpp_invite_quota,
          cap: event.rrpp_total_cap,
          points: event.attendance_points,
          seasonId: event.season_id,
        }}
      />
      <section className="card danger-zone" aria-labelledby="danger-title">
        <p id="danger-title" className="card-title">Eliminar evento</p>
        <p className="muted">Se borran también sus invitaciones y el registro de la puerta. Si solo querés sacarlo de la web, pasalo a borrador.</p>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <DeleteEventButton id={event.id} name={event.name} />
      </section>
    </div>
  )
}
