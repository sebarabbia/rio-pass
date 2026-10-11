import Link from 'next/link'
import { Suspense } from 'react'
import { EventCard } from '@/components/EventCard'
import { Logo } from '@/components/Logo'
import { getUpcomingEvents } from '@/lib/events'

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <Logo className="hero-logo" />
        <p className="kicker">Temporada de verano · Paraná</p>
        <h1 className="hero-title">Las noches de Rio, en un solo lugar.</h1>
        <p className="hero-sub">
          Mirá las próximas fechas y creá tu cuenta para tener a mano tus entradas, invitaciones y puntos.
        </p>
        <div className="hero-actions">
          <Link href="#eventos" className="btn btn-primary">Ver fechas</Link>
          <Link href="/registro" className="btn btn-secondary">Crear cuenta</Link>
        </div>
      </section>

      <section id="eventos" className="section" aria-labelledby="eventos-title">
        <h2 id="eventos-title" className="section-title">Próximas fechas</h2>
        <Suspense fallback={<EventsSkeleton />}>
          <UpcomingEvents />
        </Suspense>
      </section>
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
