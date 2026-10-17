import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Logo } from '@/components/Logo'
import { BuyBox } from '@/components/BuyBox'
import { Countdown } from '@/components/Countdown'
import { ShareEvent } from '@/components/ShareEvent'
import { flyerUrl, getPublicEvent, GOING_MIN } from '@/lib/events'
import { dateParts, formatLongDay, formatShortDay, formatTime } from '@/lib/format'
import { getCurrentUser } from '@/lib/auth'
import { getTicketOffer, nowIso } from '@/lib/sales'
import { createClient } from '@/lib/supabase/server'
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
  const { day, month, weekday } = dateParts(event.starts_at)
  return (
    <article className="event2">
      <Link href="/#eventos" className="back-link event2-back">← Todas las fechas</Link>

      <figure className="event2-flyer">
        <span className="event2-paper">
          {flyer ? (
            // eslint-disable-next-line @next/next/no-img-element -- flyers ya optimizados en Storage
            <img src={flyer} alt={`Flyer de ${event.name}`} fetchPriority="high" />
          ) : (
            <span className="event-flyer-empty">
              <Logo className="event-flyer-logo" title="" />
            </span>
          )}
        </span>
      </figure>

      <div className="event2-info">
        <div className="event2-date hero2-in" style={{ '--i': 0 } as React.CSSProperties}>
          <span className="event2-day">{day}</span>
          <span className="event2-month">
            {weekday}
            <br />
            {month}
          </span>
          <Countdown startsAt={event.starts_at} className="event2-countdown" />
        </div>
        <h1 className="event2-title hero2-in" style={{ '--i': 1 } as React.CSSProperties}>{event.name}</h1>

        <dl className="spec hero2-in" style={{ '--i': 2 } as React.CSSProperties}>
          <div>
            <dt>Fecha</dt>
            <dd>{formatLongDay(event.starts_at)}</dd>
          </div>
          <div>
            <dt>Horario</dt>
            <dd>
              Desde las {formatTime(event.starts_at)} h{event.ends_at ? ` hasta las ${formatTime(event.ends_at)} h` : ''}
            </dd>
          </div>
          <div>
            <dt>Lugar</dt>
            <dd>{event.venue}</dd>
          </div>
          {event.sectors.length > 0 && (
            <div>
              <dt>Sectores</dt>
              <dd>{event.sectors.join(' · ')}</dd>
            </div>
          )}
        </dl>

        {event.going >= GOING_MIN && (
          <p className="event-going is-big">🔥 {event.going} personas ya tienen su QR para esta noche</p>
        )}

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

        <Suspense fallback={null}>
          <TicketSales eventId={event.id} eventSlug={event.slug} />
        </Suspense>

        {event.description && <p className="event2-description">{event.description}</p>}

        <Suspense fallback={<HowToEnter onSale={false} />}>
          <HowToEnterWithSales eventId={event.id} />
        </Suspense>
      </div>
    </article>
  )
}

/** Venta online (si la fecha tiene sectores con precio): disponibilidad al momento y sesión. */
async function TicketSales({ eventId, eventSlug }: { eventId: string; eventSlug: string }) {
  const [offer, user] = await Promise.all([getTicketOffer(eventId), getCurrentUser()])
  if (offer.length === 0) return null
  if (!user) return <BuyBox eventId={eventId} eventSlug={eventSlug} offer={offer} loggedIn={false} />

  // Su propia reserva vigente (por ejemplo, si volvió de Mercado Pago sin pagar) no le
  // cuenta en contra: al comprar de nuevo, esa reserva se reemplaza.
  const supabase = await createClient()
  const { data: mine } = await supabase
    .from('orders')
    .select('order_items(ticket_type_id, quantity)')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .eq('kind', 'entradas')
    .eq('status', 'pendiente')
    .gt('expires_at', nowIso())
  const held = new Map<string, number>()
  for (const order of mine ?? []) {
    for (const item of order.order_items) {
      if (item.ticket_type_id) held.set(item.ticket_type_id, (held.get(item.ticket_type_id) ?? 0) + item.quantity)
    }
  }
  const adjusted = offer.map((o) =>
    o.available === null ? o : { ...o, available: o.available + (held.get(o.ticket_type_id) ?? 0) },
  )
  return <BuyBox eventId={eventId} eventSlug={eventSlug} offer={adjusted} loggedIn />
}

async function HowToEnterWithSales({ eventId }: { eventId: string }) {
  const offer = await getTicketOffer(eventId)
  return <HowToEnter onSale={offer.some((o) => o.on_sale && o.available !== 0)} />
}

function HowToEnter({ onSale }: { onSale: boolean }) {
  return (
    <section className="steps" aria-labelledby="como-entro">
      <h2 id="como-entro" className="steps-title">
        ¿Cómo <em>entro</em>?
      </h2>
      <ol className="steps-list">
        <li>
          <span className="steps-n">01</span>
          <p>
            {onSale
              ? 'Comprá tu entrada acá arriba o pedile tu QR sin cargo a uno de nuestros RRPP (son limitados).'
              : 'Pedile tu QR sin cargo a uno de nuestros RRPP. Son limitados.'}
          </p>
        </li>
        <li>
          <span className="steps-n">02</span>
          <p>
            Tu QR queda en <Link href="/cuenta">Mi cuenta</Link>
            {onSale ? '' : ' y te llega por WhatsApp'}.
          </p>
        </li>
        <li>
          <span className="steps-n">03</span>
          <p>Mostralo en la puerta. Sacale una captura antes: en la playa a veces no hay señal.</p>
        </li>
      </ol>
    </section>
  )
}
