import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { InvitationForm } from '@/components/InvitationForm'
import { InvitationList, type InvitationRow } from '@/components/InvitationList'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { formatShortDay, formatTime } from '@/lib/format'
import { getOrigin } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Invitaciones del evento' }

export default function EventInvitationsPage({ params }: PageProps<'/organizador/eventos/[id]/invitaciones'>) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EventInvitations params={params} />
    </Suspense>
  )
}

async function EventInvitations({ params }: { params: PageProps<'/organizador/eventos/[id]/invitaciones'>['params'] }) {
  const { id } = await params
  const user = await requireUser(`/organizador/eventos/${id}/invitaciones`)
  if (!hasRole(user, 'organizador')) notFound()

  const supabase = await createClient()
  const [{ data: event }, { data: tickets }, origin] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, starts_at, status, rrpp_invite_quota, ticket_types(id, name, sort_order, is_active)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('tickets')
      .select('id, code, holder_name, holder_email, holder_phone, status, ticket_types(name), issuer:profiles!tickets_issued_by_fkey(full_name)')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
    getOrigin(),
  ])
  if (!event) notFound()

  const rows: InvitationRow[] = (tickets ?? []).map((t) => ({
    ...t,
    sector: t.ticket_types?.name ?? null,
    issuer: t.issuer?.full_name ?? null,
  }))
  const count = (s: InvitationRow['status']) => rows.filter((r) => r.status === s).length
  const sectors = event.ticket_types.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const when = `${formatShortDay(event.starts_at)} ${formatTime(event.starts_at)} h`

  return (
    <div className="page">
      <Link href="/organizador" className="back-link">← Eventos</Link>
      <p className="kicker">{when}</p>
      <h1 className="page-title">{event.name}</h1>
      <div className="stats">
        <div className="stat"><b>{count('valido')}</b><span>Válidos</span></div>
        <div className="stat"><b>{count('usado')}</b><span>Usados</span></div>
        <div className="stat"><b>{count('anulado')}</b><span>Anulados</span></div>
      </div>
      <p className="muted small">
        Cada RRPP puede generar hasta {event.rrpp_invite_quota} QR para esta fecha (se cambia editando el evento). Como organizador no tenés límite.
      </p>

      <InvitationForm eventId={event.id} eventName={event.name} when={when} origin={origin} sectors={sectors} />

      <section className="section-block" aria-labelledby="todas">
        <h2 id="todas" className="block-title">Todas las invitaciones ({rows.length})</h2>
        <InvitationList rows={rows} eventId={event.id} eventName={event.name} when={when} origin={origin} showIssuer />
      </section>
    </div>
  )
}
