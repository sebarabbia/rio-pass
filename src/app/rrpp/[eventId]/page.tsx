import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { InvitationForm } from '@/components/InvitationForm'
import { InvitationList, type InvitationRow } from '@/components/InvitationList'
import { NoAccess, PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { formatShortDay, formatTime } from '@/lib/format'
import { getOrigin } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Invitaciones' }

export default function RrppEventPage({ params }: PageProps<'/rrpp/[eventId]'>) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RrppEvent params={params} />
    </Suspense>
  )
}

async function RrppEvent({ params }: { params: PageProps<'/rrpp/[eventId]'>['params'] }) {
  const { eventId } = await params
  const user = await requireUser(`/rrpp/${eventId}`)
  if (!hasRole(user, 'rrpp')) return <NoAccess role="RRPP" />

  const supabase = await createClient()
  const [{ data: event }, { data: tickets }, origin] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, starts_at, rrpp_invite_quota, ticket_types(id, name, sort_order, is_active)')
      .eq('id', eventId)
      .eq('status', 'publicado')
      .maybeSingle(),
    supabase
      .from('tickets')
      .select('id, code, holder_name, holder_email, holder_phone, status, ticket_types(name)')
      .eq('event_id', eventId)
      .eq('issued_by', user.id)
      .eq('kind', 'invitacion')
      .order('created_at', { ascending: false }),
    getOrigin(),
  ])
  if (!event) notFound()

  const rows: InvitationRow[] = (tickets ?? []).map((t) => ({ ...t, sector: t.ticket_types?.name ?? null }))
  const used = rows.filter((r) => r.status !== 'anulado').length
  const left = Math.max(0, event.rrpp_invite_quota - used)
  const sectors = event.ticket_types.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const when = `${formatShortDay(event.starts_at)} ${formatTime(event.starts_at)} h`

  return (
    <div className="page">
      <Link href="/rrpp" className="back-link">← Mis fechas</Link>
      <p className="kicker">{when}</p>
      <h1 className="page-title">{event.name}</h1>
      <div className="card quota-card">
        <p className="quota-big">{left}</p>
        <p className="points-label">QR disponibles de {event.rrpp_invite_quota}</p>
      </div>

      <InvitationForm
        eventId={event.id}
        eventName={event.name}
        when={when}
        origin={origin}
        sectors={sectors}
        disabled={left === 0}
      />

      <section className="section-block" aria-labelledby="mis-invitaciones">
        <h2 id="mis-invitaciones" className="block-title">Mis invitaciones ({rows.length})</h2>
        <InvitationList rows={rows} eventId={event.id} eventName={event.name} when={when} origin={origin} />
      </section>
    </div>
  )
}
