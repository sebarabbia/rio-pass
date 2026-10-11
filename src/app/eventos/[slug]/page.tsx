import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Logo } from '@/components/Logo'
import { flyerUrl, getPublicEvent } from '@/lib/events'
import { formatLongDay, formatTime } from '@/lib/format'

export async function generateMetadata({ params }: PageProps<'/eventos/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const event = await getPublicEvent(slug)
  if (!event) return { title: 'Evento no encontrado' }
  const flyer = flyerUrl(event.flyer_path)
  return {
    title: event.name,
    description: `${formatLongDay(event.starts_at)} · ${formatTime(event.starts_at)} h · ${event.venue}.`,
    openGraph: flyer ? { images: [{ url: flyer }] } : undefined,
  }
}

export default function EventPage({ params }: PageProps<'/eventos/[slug]'>) {
  return (
    <Suspense fallback={<div className="page"><p className="muted">Cargando evento…</p></div>}>
      <EventDetail params={params} />
    </Suspense>
  )
}

async function EventDetail({ params }: { params: PageProps<'/eventos/[slug]'>['params'] }) {
  const { slug } = await params
  const event = await getPublicEvent(slug)
  if (!event) notFound()

  const flyer = flyerUrl(event.flyer_path)
  return (
    <article className="page event-detail">
      <Link href="/#eventos" className="back-link">← Todas las fechas</Link>

      <div className="event-detail-flyer">
        {flyer ? (
          // eslint-disable-next-line @next/next/no-img-element -- flyers ya optimizados en Storage
          <img src={flyer} alt={`Flyer de ${event.name}`} />
        ) : (
          <div className="event-flyer-empty">
            <Logo className="event-flyer-logo" />
          </div>
        )}
      </div>

      <p className="kicker">{formatLongDay(event.starts_at)}</p>
      <h1 className="page-title">{event.name}</h1>
      <p className="event-detail-time">
        Desde las {formatTime(event.starts_at)} h{event.ends_at ? ` hasta las ${formatTime(event.ends_at)} h` : ''}
        <br />
        {event.venue}
      </p>

      {event.sectors.length > 0 && (
        <ul className="chips" aria-label="Sectores">
          {event.sectors.map((s) => (
            <li key={s} className="chip">{s}</li>
          ))}
        </ul>
      )}

      {event.description && <p className="event-detail-description">{event.description}</p>}

      <div className="card notice">
        <p className="card-title">¿Cómo entro?</p>
        <p className="muted">
          Pedile tu QR sin cargo a uno de nuestros RRPP (son limitados). Te llega por WhatsApp y, si tenés cuenta con el
          mismo email, también lo ves en <Link href="/cuenta">Mi cuenta</Link>. La venta online de entradas llega pronto.
        </p>
      </div>
    </article>
  )
}
