import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { logout } from '@/app/auth/actions'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser, ROLE_LABELS } from '@/lib/auth'
import { firstName, formatShortDay, formatTime } from '@/lib/format'
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

const TICKET_KIND = { entrada: 'Entrada', invitacion: 'Invitación' } as const
const TICKET_STATUS = { valido: 'Válido', usado: 'Usado', anulado: 'Anulado' } as const

async function Account() {
  const user = await requireUser('/cuenta')
  const supabase = await createClient()

  const [{ data: cards }, { data: tickets }, { data: season }] = await Promise.all([
    supabase.from('nfc_cards').select('id, uid, status, label').eq('user_id', user.id),
    supabase
      .from('tickets')
      .select('id, kind, status, code, ticket_types(name), events(name, slug, starts_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('seasons').select('id, name').eq('is_current', true).maybeSingle(),
  ])

  let points = 0
  if (season) {
    const { data: movements } = await supabase
      .from('points_ledger')
      .select('points')
      .eq('user_id', user.id)
      .eq('season_id', season.id)
    points = (movements ?? []).reduce((sum, m) => sum + m.points, 0)
  }

  const name = firstName(user.fullName)

  return (
    <div className="page">
      <p className="kicker">Mi cuenta</p>
      <h1 className="page-title">{name ? `Hola, ${name}` : 'Hola'}</h1>
      <ul className="chips" aria-label="Tus roles">
        {user.roles.map((role) => (
          <li key={role} className="chip">{ROLE_LABELS[role]}</li>
        ))}
      </ul>
      {hasRole(user, 'organizador') && (
        <Link href="/organizador" className="btn btn-primary btn-block">Ir al panel de organizador</Link>
      )}
      {hasRole(user, 'rrpp') && (
        <Link href="/rrpp" className="btn btn-secondary btn-block">Panel RRPP: generar invitaciones</Link>
      )}

      {/* ---------------- Mis tarjetas ---------------- */}
      <section className="section-block" aria-labelledby="tarjetas">
        <h2 id="tarjetas" className="block-title">Mis tarjetas</h2>
        {cards && cards.length > 0 ? (
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
        ) : (
          <div className="empty">
            <p className="empty-title">Todavía no tenés tarjeta</p>
            <p>Las tarjetas Rio Pass se entregan a los RRPP de la temporada. Cuando te asignen una, la vas a ver acá.</p>
          </div>
        )}
      </section>

      {/* ---------------- Mis QR ---------------- */}
      <section className="section-block" aria-labelledby="qr">
        <h2 id="qr" className="block-title">Mis QR</h2>
        {tickets && tickets.length > 0 ? (
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
        ) : (
          <div className="empty">
            <p className="empty-title">No tenés entradas ni invitaciones</p>
            <p>Cuando compres una entrada o te regalen una invitación, tu QR para la puerta va a aparecer acá.</p>
          </div>
        )}
      </section>

      {/* ---------------- Mis puntos ---------------- */}
      <section className="section-block" aria-labelledby="puntos">
        <h2 id="puntos" className="block-title">Mis puntos</h2>
        <div className="card points-card">
          <p className="points-value">{points}</p>
          <p className="points-label">{season ? `puntos · ${season.name}` : 'puntos esta temporada'}</p>
          <p className="muted">
            Sumás puntos cada vez que venís a Rio. Al final de la temporada premiamos al top 10 del ranking.
          </p>
        </div>
      </section>

      {/* ---------------- Mis datos ---------------- */}
      <section className="section-block" aria-labelledby="datos">
        <h2 id="datos" className="block-title">Mis datos</h2>
        <div className="card">
          <ProfileForm fullName={user.fullName} phone={user.phone} email={user.email} />
        </div>
      </section>

      <form action={logout} className="section-block">
        <button type="submit" className="btn btn-ghost btn-block">Cerrar sesión</button>
      </form>
    </div>
  )
}
