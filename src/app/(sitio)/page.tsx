import Link from 'next/link'
import { Suspense } from 'react'
import { EventCard } from '@/components/EventCard'
import { Logo } from '@/components/Logo'
import { RankingList } from '@/components/RankingList'
import { getCurrentUser } from '@/lib/auth'
import { getUpcomingEvents } from '@/lib/events'
import { firstName } from '@/lib/format'
import { getPublicPodium, PRIZE_POSITIONS } from '@/lib/ranking'

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <Logo className="hero-logo" />
        <p className="kicker">Temporada de verano · Paraná</p>
        <h1 className="hero-title">Las noches de Rio, en un solo lugar.</h1>
        <Suspense fallback={<div className="hero-actions is-placeholder" aria-hidden="true" />}>
          <HeroActions />
        </Suspense>
      </section>

      <section id="eventos" className="section" aria-labelledby="eventos-title">
        <h2 id="eventos-title" className="section-title">Próximas fechas</h2>
        <Suspense fallback={<EventsSkeleton />}>
          <UpcomingEvents />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <RankingTeaser />
      </Suspense>
    </>
  )
}

/** Podio de la temporada: invita a entrar al ranking (y a crearse la cuenta). */
async function RankingTeaser() {
  const { season, rows } = await getPublicPodium()
  if (!season) return null
  return (
    <section className="section ranking-teaser" aria-labelledby="ranking-title">
      <h2 id="ranking-title" className="section-title">Ranking {season}</h2>
      <p className="muted">
        Cada noche que venís sumás puntos. Al final de la temporada, el top {PRIZE_POSITIONS} se lleva premio.
      </p>
      {rows.length > 0 && <RankingList rows={rows} compact />}
      <Link href="/ranking" className="btn btn-secondary">Ver ranking</Link>
    </section>
  )
}

/** Los botones dependen de la sesión: a quien ya tiene cuenta no se le ofrece crearla. */
async function HeroActions() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <>
        <p className="hero-sub">Creá tu cuenta para tener a mano tus invitaciones y sumar puntos cada noche que venís.</p>
        <div className="hero-actions">
          <Link href="/registro" className="btn btn-primary">Crear cuenta</Link>
          <Link href="/ingresar" className="btn btn-secondary">Ingresar</Link>
        </div>
      </>
    )
  }
  const name = firstName(user.fullName)
  return (
    <>
      <p className="hero-sub">{name ? `Hola, ${name}. ` : ''}Tus QR y tus puntos están en tu cuenta.</p>
      <div className="hero-actions">
        <Link href="/cuenta" className="btn btn-primary">Mis QR</Link>
        <Link href="/ranking" className="btn btn-secondary">Ranking</Link>
      </div>
    </>
  )
}

async function UpcomingEvents() {
  const events = await getUpcomingEvents()
  if (events.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">Pronto anunciamos nuevas fechas</p>
        <p>Creá tu cuenta y enterate primero.</p>
      </div>
    )
  }
  return (
    <ul className="event-grid">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </ul>
  )
}

function EventsSkeleton() {
  return (
    <ul className="event-grid" aria-hidden="true">
      {[0, 1].map((i) => (
        <li key={i} className="event-card skeleton">
          <div className="event-flyer" />
          <div className="event-body">
            <p className="event-date">&nbsp;</p>
            <p className="event-name">&nbsp;</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
