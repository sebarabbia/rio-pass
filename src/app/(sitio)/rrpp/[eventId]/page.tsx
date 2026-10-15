import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { InvitationForm } from '@/components/InvitationForm'
import { InvitationList, type InvitationRow } from '@/components/InvitationList'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { formatShortDay, formatTime } from '@/lib/format'
import { getOrigin, qrSvg, ticketUrl } from '@/lib/site'
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
  if (!hasRole(user, 'rrpp')) notFound()

  const supabase = await createClient()
  const [{ data: event }, { data: statuses }, { data: tickets }, { data: pass }, origin] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, starts_at, ticket_types(id, name, sort_order, is_active)')
      .eq('id', eventId)
      .eq('status', 'publicado')
      .maybeSingle(),
    supabase.rpc('rrpp_event_status'),
    supabase
      .from('tickets')
      .select('id, code, holder_name, holder_email, holder_phone, status, kind, ticket_types(name)')
      .eq('event_id', eventId)
      .eq('issued_by', user.id)
      .eq('kind', 'invitacion')
      .order('created_at', { ascending: false }),
    supabase
      .from('tickets')
      .select('code, status, used_at')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .eq('kind', 'rrpp')
      .neq('status', 'anulado')
      .maybeSingle(),
    getOrigin(),
  ])
  if (!event) notFound()

  const status = statuses?.find((s) => s.event_id === eventId)
  const when = `${formatShortDay(event.starts_at)} ${formatTime(event.starts_at)} h`

  if (!status?.enabled) {
    return (
      <div className="page">
        <Link href="/rrpp" className="back-link">← Mis fechas</Link>
        <p className="kicker">{when}</p>
        <h1 className="page-title">{event.name}</h1>
        <div className="card notice">
          <p className="card-title">Todavía no están habilitados tus QR</p>
          <p className="muted">
            Se habilitan cuando hacés la primera difusión de la fecha.
            {status?.manager_name ? ` Avisale a ${status.manager_name} cuando la hagas.` : ' Avisale a tu organizador cuando la hagas.'}
          </p>
        </div>
      </div>
    )
  }

  const rows: InvitationRow[] = (tickets ?? []).map((t) => ({ ...t, sector: t.ticket_types?.name ?? null }))
  const left = Math.max(0, status.quota - status.used)
  const capLeft = status.cap != null ? Math.max(0, status.cap - status.cap_used) : null
  const sectors = event.ticket_types.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const passSvg = pass ? await qrSvg(ticketUrl(origin, pass.code)) : null
  const blockedReason =
    capLeft === 0
      ? 'Se llegó al tope de QR sin cargo de esta fecha. Ya no se pueden regalar más.'
      : 'Ya usaste todos tus QR para esta fecha. Anulá uno sin usar para liberar un lugar.'

  return (
    <div className="page">
      <Link href="/rrpp" className="back-link">← Mis fechas</Link>
      <p className="kicker">{when}</p>
      <h1 className="page-title">{event.name}</h1>

      {pass && passSvg && (
        <section className="card next-ticket rrpp-pass" aria-labelledby="mi-qr">
          <p className="kicker" id="mi-qr">Tu QR · intransferible</p>
          <div className="next-ticket-qr" role="img" aria-label="Tu código QR de ingreso" dangerouslySetInnerHTML={{ __html: passSvg }} />
          {pass.status === 'usado' ? (
            <p className="muted">Ya entraste con este QR{pass.used_at ? ` a las ${formatTime(pass.used_at)} h` : ''}.</p>
          ) : (
            <p className="muted small">Es solo para vos: no lo compartas. También lo tenés en Mi cuenta.</p>
          )}
          <Link href={`/qr/${pass.code}`} className="btn btn-secondary btn-block">Ver en grande</Link>
        </section>
      )}

      <div className="card quota-card">
        <p className="quota-big">{left}</p>
        <p className="points-label">QR para regalar de {status.quota} (incluye el tuyo)</p>
        {capLeft !== null && (
          <p className={capLeft === 0 ? 'form-error' : 'muted small'}>
            {capLeft === 0 ? 'Se llegó al tope de la fecha.' : `Quedan ${capLeft} de ${status.cap} en total para esta fecha: el que llega primero, regala.`}
          </p>
        )}
      </div>

      <InvitationForm
        eventId={event.id}
        eventName={event.name}
        when={when}
        origin={origin}
        sectors={sectors}
        disabled={left === 0 || capLeft === 0}
        disabledReason={blockedReason}
      />

      <section className="section-block" aria-labelledby="mis-invitaciones">
        <h2 id="mis-invitaciones" className="block-title">QR que regalaste ({rows.length})</h2>
        <InvitationList rows={rows} eventId={event.id} eventName={event.name} when={when} origin={origin} />
      </section>
    </div>
  )
}
