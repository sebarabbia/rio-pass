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

type Props = PageProps<'/organizador/eventos/[id]/invitaciones'>
const ORIGINS = { todos: 'Todos', organizadores: 'De organizadores', rrpp: 'De RRPP' } as const
type Origin = keyof typeof ORIGINS
const LIMIT = 300

export default function EventInvitationsPage(props: Props) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EventInvitations {...props} />
    </Suspense>
  )
}

async function EventInvitations({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const user = await requireUser(`/organizador/eventos/${id}/invitaciones`)
  if (!hasRole(user, 'organizador')) notFound()

  const rawQ = typeof query.q === 'string' ? query.q : ''
  // Se sacan caracteres que tienen significado en los filtros de la API.
  const q = rawQ.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)
  const originFilter = (typeof query.origen === 'string' && query.origen in ORIGINS ? query.origen : 'todos') as Origin
  const rrppFilter = typeof query.rrpp === 'string' && /^[0-9a-f-]{36}$/.test(query.rrpp) ? query.rrpp : null

  const supabase = await createClient()
  let ticketsQuery = supabase
    .from('tickets')
    .select(
      'id, code, holder_name, holder_email, holder_phone, status, kind, ticket_types(name), issuer:profiles!tickets_issued_by_fkey(full_name), rrpp:profiles!tickets_rrpp_id_fkey(full_name)',
    )
    .eq('event_id', id)
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (q) ticketsQuery = ticketsQuery.or(`holder_name.ilike.%${q}%,holder_email.ilike.%${q}%`)
  if (rrppFilter) ticketsQuery = ticketsQuery.eq('rrpp_id', rrppFilter)
  else if (originFilter === 'organizadores') ticketsQuery = ticketsQuery.is('rrpp_id', null)
  else if (originFilter === 'rrpp') ticketsQuery = ticketsQuery.not('rrpp_id', 'is', null)

  const countStatus = (status: 'valido' | 'usado' | 'anulado') =>
    supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', id).eq('status', status)

  const [{ data: event }, { data: tickets }, origin, valid, used, voided] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, starts_at, status, ticket_types(id, name, sort_order, is_active)')
      .eq('id', id)
      .maybeSingle(),
    ticketsQuery,
    getOrigin(),
    countStatus('valido'),
    countStatus('usado'),
    countStatus('anulado'),
  ])
  if (!event) notFound()

  // El QR cuenta para quien lo regaló: el RRPP (si es suyo) o el organizador que lo emitió.
  const rows: InvitationRow[] = (tickets ?? []).map((t) => ({
    ...t,
    sector: t.ticket_types?.name ?? null,
    issuer: t.rrpp?.full_name ?? t.issuer?.full_name ?? null,
  }))
  const sectors = event.ticket_types.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const when = `${formatShortDay(event.starts_at)} ${formatTime(event.starts_at)} h`

  return (
    <div className="page wide">
      <Link href="/organizador" className="back-link">← Eventos</Link>
      <p className="kicker">{when}</p>
      <h1 className="page-title">{event.name}</h1>
      <div className="stats">
        <div className="stat"><b>{valid.count ?? 0}</b><span>Válidos</span></div>
        <div className="stat"><b>{used.count ?? 0}</b><span>Usados</span></div>
        <div className="stat"><b>{voided.count ?? 0}</b><span>Anulados</span></div>
      </div>
      <p className="muted small">
        Como organizador regalás sin límite y tus QR no cuentan para el tope de RRPP. Los RRPP se habilitan en{' '}
        <Link href={`/organizador/eventos/${event.id}/rrpp`}>RRPP de esta fecha</Link>.
      </p>

      <InvitationForm eventId={event.id} eventName={event.name} when={when} origin={origin} sectors={sectors} />

      <section className="section-block" aria-labelledby="todas">
        <h2 id="todas" className="block-title">QR entregados</h2>
        <form className="search" role="search">
          <input name="q" type="search" className="input" placeholder="Buscar por nombre o email" defaultValue={rawQ} aria-label="Buscar QR" />
          <select name="origen" className="input" defaultValue={originFilter} aria-label="Quién lo entregó">
            {Object.entries(ORIGINS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">Buscar</button>
        </form>
        {rrppFilter && (
          <p className="muted small">
            Mostrando los QR de un RRPP. <Link href={`/organizador/eventos/${event.id}/invitaciones`}>Ver todos</Link>
          </p>
        )}
        <InvitationList rows={rows} eventId={event.id} eventName={event.name} when={when} origin={origin} showIssuer />
        {rows.length === LIMIT && <p className="muted small">Se muestran los últimos {LIMIT}. Buscá para encontrar uno en particular.</p>}
      </section>
    </div>
  )
}
