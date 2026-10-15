import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { logout } from '@/app/auth/actions'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { upcomingSince } from '@/lib/events'
import { firstName, formatLongDay, formatShortDay, formatTime } from '@/lib/format'
import { getMyRanking, REASON_LABELS, standingMessage } from '@/lib/ranking'
import { getOrigin, qrSvg, ticketUrl } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './ProfileForm'

export const metadata: Metadata = { title: 'Mi cuenta' }

export default function AccountPage() {
  return (
    <Suspense fallback={<PageLoading label="Cargando tu cuenta…" />}>
      <Account />
    </Suspense>
  )
}

const TICKET_KIND = { entrada: 'Entrada', invitacion: 'Invitación', rrpp: 'QR de RRPP' } as const
const TICKET_STATUS = { valido: 'Válido', usado: 'Usado', anulado: 'Anulado' } as const

async function Account() {
  const user = await requireUser('/cuenta')
  const supabase = await createClient()

  const [{ data: cards }, { data: tickets }, me, origin] = await Promise.all([
    supabase.from('nfc_cards').select('id, uid, status, label').eq('user_id', user.id),
    supabase
      .from('tickets')
      .select('id, kind, status, code, ticket_types(name), events(name, slug, starts_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    getMyRanking(),
    getOrigin(),
  ])

  // QR que todavía sirven (válidos y de fechas que no pasaron) y el resto, que va plegado.
  const since = upcomingSince()
  const isUpcoming = (t: NonNullable<typeof tickets>[number]) => t.status === 'valido' && !!t.events && t.events.starts_at >= since
  const upcomingTickets = (tickets ?? []).filter(isUpcoming).sort((a, b) => a.events!.starts_at.localeCompare(b.events!.starts_at))
  const pastTickets = (tickets ?? []).filter((t) => !isUpcoming(t))
  const nextTicket = upcomingTickets[0]
  const nextQr = nextTicket ? await qrSvg(ticketUrl(origin, nextTicket.code)) : null

  // Últimos movimientos de puntos de la temporada actual.
  const { data: movements } = me
    ? await supabase
        .from('points_ledger')
        .select('id, points, reason, note, created_at, events(name)')
        .eq('user_id', user.id)
        .eq('season_id', me.season_id)
        .order('created_at', { ascending: false })
        .limit(6)
    : { data: [] }

  const name = firstName(user.fullName)

  return (
    <div className="page">
      <p className="kicker">Mi cuenta</p>
      <h1 className="page-title">{name ? `Hola, ${name}` : 'Hola'}</h1>

      {/* ---------------- Tu próxima entrada: el QR a mano, sin buscarlo ---------------- */}
      {nextTicket && nextQr && nextTicket.events && (
        <section className="card next-ticket" aria-labelledby="proxima">
          <p className="kicker" id="proxima">Tu próxima entrada</p>
          <p className="card-title">{nextTicket.events.name}</p>
          <p className="muted">
            {formatLongDay(nextTicket.events.starts_at)} · {formatTime(nextTicket.events.starts_at)} h
            {nextTicket.ticket_types?.name ? ` · ${nextTicket.ticket_types.name}` : ''}
          </p>
          <div className="next-ticket-qr" role="img" aria-label="Código QR de ingreso" dangerouslySetInnerHTML={{ __html: nextQr }} />
          <Link href={`/qr/${nextTicket.code}`} className="btn btn-primary btn-block">Ver en grande</Link>
          <p className="muted small">Sacale una captura: si en la puerta no hay señal, la mostrás igual.</p>
        </section>
      )}
      {/* Accesos de staff: solo los ve quien tiene ese rol. Un cliente no ve nada de esto. */}
      {hasRole(user, 'organizador') && (
        <Link href="/organizador" className="btn btn-primary btn-block">Ir al panel de organizador</Link>
      )}
      {(hasRole(user, 'acreditador') || hasRole(user, 'organizador')) && (
        <Link href="/puerta" className="btn btn-secondary btn-block">Abrir la puerta (validar ingresos)</Link>
      )}
      {hasRole(user, 'rrpp') && (
        <Link href="/rrpp" className="btn btn-secondary btn-block">Generar invitaciones</Link>
      )}

      {/* ---------------- Mis tarjetas (solo si tiene) ---------------- */}
      {cards && cards.length > 0 && (
        <section className="section-block" aria-labelledby="tarjetas">
          <h2 id="tarjetas" className="block-title">Mis tarjetas</h2>
          <ul className="list">
            {cards.map((card) => (
              <li key={card.id} className="card row">
                <div>
                  <p className="card-title">Tarjeta Rio Pass{card.label ? ` · ${card.label}` : ''}</p>
                  <p className="mono muted">•• {card.uid.split(':').slice(-3).join(':')}</p>
                </div>
                <span className={`pill ${card.status === 'activa' ? 'pill-ok' : 'pill-bad'}`}>
                  {card.status === 'activa' ? 'Activa' : 'Bloqueada'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------- Mis QR ---------------- */}
      <section className="section-block" aria-labelledby="qr">
        <h2 id="qr" className="block-title">Mis QR</h2>
        {upcomingTickets.length > 0 ? (
          <TicketList tickets={upcomingTickets} />
        ) : (
          <div className="empty">
            <p className="empty-title">No tenés entradas para las próximas fechas</p>
            <p>Cuando te regalen una invitación o compres una entrada, tu QR para la puerta va a aparecer acá.</p>
          </div>
        )}
        {pastTickets.length > 0 && (
          <details className="past-tickets">
            <summary>Ver anteriores ({pastTickets.length})</summary>
            <TicketList tickets={pastTickets} />
          </details>
        )}
      </section>

      {/* ---------------- Mis puntos ---------------- */}
      <section className="section-block" aria-labelledby="puntos">
        <h2 id="puntos" className="block-title">Mis puntos</h2>
        <div className="card points-card">
          <p className="points-value">{me?.points ?? 0}</p>
          <p className="points-label">{me ? `puntos · ${me.season_name}` : 'puntos esta temporada'}</p>
          {me?.position ? (
            <p className="points-rank">
              Puesto <strong>#{me.position}</strong> {me.league === 'rrpp' ? 'entre RRPP' : `de ${me.players}`}
            </p>
          ) : null}
          <p className="muted">
            {me ? standingMessage(me) : 'Sumás puntos cada vez que venís a Rio. Al final de la temporada premiamos al top 10 del ranking.'}
          </p>
          <Link href={me?.league === 'rrpp' ? '/ranking?liga=rrpp' : '/ranking'} className="btn btn-secondary btn-sm points-link">
            Ver ranking
          </Link>
        </div>
        {movements && movements.length > 0 && (
          <ul className="list movements">
            {movements.map((m) => (
              <li key={m.id} className="movement">
                <span className={`movement-points${m.points < 0 ? ' is-negative' : ''}`}>
                  {m.points > 0 ? `+${m.points}` : m.points}
                </span>
                <span className="movement-text">
                  {REASON_LABELS[m.reason]}
                  {m.events?.name ? ` · ${m.events.name}` : ''}
                  {m.note ? ` · ${m.note}` : ''}
                </span>
                <span className="movement-date">{formatShortDay(m.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- Mis datos ---------------- */}
      <section className="section-block" aria-labelledby="datos">
        <h2 id="datos" className="block-title">Mis datos</h2>
        <div className="card">
          <ProfileForm fullName={user.fullName} phone={user.phone} email={user.email} />
        </div>
        <Link href="/cuenta/contrasena" className="btn btn-secondary btn-block section-gap">Cambiar contraseña</Link>
      </section>

      <form action={logout} className="section-block">
        <button type="submit" className="btn btn-ghost btn-block">Cerrar sesión</button>
      </form>
    </div>
  )
}

type TicketRow = {
  id: string
  kind: 'entrada' | 'invitacion' | 'rrpp'
  status: 'valido' | 'usado' | 'anulado'
  code: string
  ticket_types: { name: string } | null
  events: { name: string; slug: string; starts_at: string } | null
}

function TicketList({ tickets }: { tickets: TicketRow[] }) {
  return (
    <ul className="list">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link href={`/qr/${ticket.code}`} className="card row link-card">
            <div>
              <p className="card-title">{ticket.events?.name ?? 'Evento'}</p>
              <p className="muted">
                {[
                  TICKET_KIND[ticket.kind],
                  ticket.ticket_types?.name,
                  ticket.events ? `${formatShortDay(ticket.events.starts_at)} ${formatTime(ticket.events.starts_at)} h` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {ticket.status === 'valido' && <p className="link-hint">Ver QR →</p>}
            </div>
            <span className={`pill ${ticket.status === 'valido' ? 'pill-ok' : 'pill-muted'}`}>{TICKET_STATUS[ticket.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
