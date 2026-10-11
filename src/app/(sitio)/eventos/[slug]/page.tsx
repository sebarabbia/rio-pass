import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Logo } from '@/components/Logo'
import { ShareEvent } from '@/components/ShareEvent'
import { flyerUrl, getPublicEvent } from '@/lib/events'
import { formatLongDay, formatShortDay, formatTime } from '@/lib/format'
import { siteUrl } from '@/lib/site'

function mapsUrl(venue: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue}, Paraná, Entre Ríos`)}`
}

export async function generateMetadata({ params }: PageProps<'/eventos/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const event = await getPublicEvent(slug)
  if (!event) return { title: 'Evento no encontrado' }
  // La imagen de vista previa sale de opengraph-image.tsx (flyer convertido a JPEG).
  return {
    title: event.name,
    description: `${formatLongDay(event.starts_at)} · ${formatTime(event.starts_at)} h · ${event.venue}.`,
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
        {event.sectors.length > 0 && (
          <>
            <br />
            <span className="muted">{event.sectors.join(' · ')}</span>
          </>
        )}
      </p>

      <div className="event-detail-actions">
        <ShareEvent
          url={`${siteUrl()}/eventos/${event.slug}`}
          title={`${event.name} · Rio`}
          text={`${event.name} en Rio, ${formatShortDay(event.starts_at)} ${formatTime(event.starts_at)} h`}
        />
        <a href={mapsUrl(event.venue)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
          Cómo llegar
        </a>
      </div>

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
