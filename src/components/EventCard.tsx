import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { flyerUrl, type PublicEvent } from '@/lib/events'
import { formatShortDay, formatTime } from '@/lib/format'

export function EventCard({ event }: { event: PublicEvent }) {
  const flyer = flyerUrl(event.flyer_path)
  return (
    <li>
      <Link href={`/eventos/${event.slug}`} className="event-card">
        <div className="event-flyer">
          {flyer ? (
            // eslint-disable-next-line @next/next/no-img-element -- flyers ya optimizados en Storage
            <img src={flyer} alt={`Flyer de ${event.name}`} loading="lazy" />
          ) : (
            <div className="event-flyer-empty">
              <Logo className="event-flyer-logo" />
            </div>
          )}
        </div>
        <div className="event-body">
          <p className="event-date">
            {formatShortDay(event.starts_at)} · {formatTime(event.starts_at)} h
          </p>
          <h3 className="event-name">{event.name}</h3>
          <p className="event-venue">{event.venue}</p>
        </div>
      </Link>
    </li>
  )
}
