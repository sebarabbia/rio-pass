import Link from 'next/link'
import { Suspense } from 'react'
import { Countdown } from '@/components/Countdown'
import { Logo } from '@/components/Logo'
import { Marquee } from '@/components/Marquee'
import { RankingList } from '@/components/RankingList'
import { RiverLine } from '@/components/RiverLine'
import { getCurrentUser } from '@/lib/auth'
import { flyerUrl, getUpcomingEvents, GOING_MIN, type PublicEvent } from '@/lib/events'
import { dateParts, firstName, formatShortDay, formatTime } from '@/lib/format'
import { getPublicPodium, PRIZE_POSITIONS } from '@/lib/ranking'

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<HeroShell />}>
        <Hero />
      </Suspense>

      <Suspense fallback={null}>
        <DatesMarquee />
      </Suspense>

      <section id="eventos" className="agenda" aria-labelledby="eventos-title">
        <header className="section-head reveal">
          <p className="eyebrow">Agenda</p>
          <h2 id="eventos-title" className="section-display">
            Próximas <em>fechas</em>
          </h2>
        </header>
        <Suspense fallback={<AgendaSkeleton />}>
          <Agenda />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <RankingTeaser />
      </Suspense>
    </>
  )
}

// ---------------------------------------------------------------- Primera pantalla

/** Titular de la marca + la próxima fecha como afiche. Los eventos vienen cacheados. */
async function Hero() {
  const events = await getUpcomingEvents()
  const next = events[0]
  return (
    <section className={`hero2${next ? '' : ' is-solo'}`}>
      <Logo className="hero2-watermark" title="" />
      <div className="hero2-copy">
        <p className="eyebrow hero2-in" style={{ '--i': 0 } as React.CSSProperties}>Temporada de verano · Paraná</p>
        <h1 className="hero2-title hero2-in" style={{ '--i': 1 } as React.CSSProperties}>
          Las noches de <em>Rio</em>, en un solo lugar.
        </h1>
        <div className="hero2-in" style={{ '--i': 2 } as React.CSSProperties}>
          <Suspense fallback={<div className="hero-actions is-placeholder" aria-hidden="true" />}>
            <HeroActions />
          </Suspense>
        </div>
      </div>
      {next && <NextPoster event={next} />}
      <RiverLine className="hero2-river" />
    </section>
  )
}

function HeroShell() {
  return (
    <section className="hero2 is-solo" aria-busy="true">
      <div className="hero2-copy">
        <p className="eyebrow">Temporada de verano · Paraná</p>
        <h1 className="hero2-title">
          Las noches de <em>Rio</em>, en un solo lugar.
        </h1>
      </div>
    </section>
  )
}

/** La próxima fecha como afiche impreso (marco de papel y epígrafe), apenas inclinado. */
function NextPoster({ event }: { event: PublicEvent }) {
  const flyer = flyerUrl(event.flyer_path)
  const { day, month, weekday } = dateParts(event.starts_at)
  return (
    <Link href={`/eventos/${event.slug}`} className="poster hero2-in" style={{ '--i': 2 } as React.CSSProperties}>
      <span className="poster-paper">
        <span className="poster-image">
          {flyer ? (
            // eslint-disable-next-line @next/next/no-img-element -- flyer ya optimizado en Storage; es la imagen principal
            <img src={flyer} alt={`Flyer de ${event.name}`} fetchPriority="high" />
          ) : (
            <span className="poster-empty"><Logo title="" /></span>
          )}
        </span>
        <span className="poster-caption">
          <span className="poster-label">Próxima fecha</span>
          <span className="poster-date">
            <span className="poster-day">{day}</span>
            <span className="poster-month">
              {weekday} · {month}
              <br />
              {formatTime(event.starts_at)} h
            </span>
          </span>
          <span className="poster-name">{event.name}</span>
          <span className="poster-foot">
            <Countdown startsAt={event.starts_at} className="poster-countdown" />
            {event.going >= GOING_MIN && <span className="poster-going">🔥 {event.going} ya tienen su QR</span>}
          </span>
        </span>
      </span>
    </Link>
  )
}

/** Los botones dependen de la sesión: a quien ya tiene cuenta no se le ofrece crearla. */
async function HeroActions() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <>
        <p className="hero2-sub">Creá tu cuenta para tener a mano tus invitaciones y sumar puntos cada noche que venís.</p>
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
      <p className="hero2-sub">{name ? `Hola, ${name}. ` : ''}Tus QR y tus puntos están en tu cuenta.</p>
      <div className="hero-actions">
        <Link href="/cuenta" className="btn btn-primary">Mis QR</Link>
        <Link href="/ranking" className="btn btn-secondary">Ranking</Link>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Agenda

async function DatesMarquee() {
  const events = await getUpcomingEvents()
  return <Marquee items={events.map((e) => `${formatShortDay(e.starts_at)} — ${e.name}`)} />
}

async function Agenda() {
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
    <ol className="agenda-list">
      {events.map((event, i) => {
        const flyer = flyerUrl(event.flyer_path)
        const { day, month, weekday } = dateParts(event.starts_at)
        return (
          <li key={event.id} className="reveal">
            <Link href={`/eventos/${event.slug}`} className="agenda-row">
              <span className="agenda-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="agenda-date" aria-label={`${weekday} ${day} de ${month}`}>
                <span className="agenda-day">{day}</span>
                <span className="agenda-month">
                  {month}
                  <br />
                  {weekday}
                </span>
              </span>
              <span className="agenda-main">
                <span className="agenda-name">{event.name}</span>
                <span className="agenda-meta">
                  {formatTime(event.starts_at)} h · {event.venue}
                </span>
                {event.going >= GOING_MIN && <span className="event-going">🔥 {event.going} ya tienen su QR</span>}
              </span>
              <span className="agenda-thumb">
                {flyer ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura del flyer
                  <img src={flyer} alt="" loading="lazy" />
                ) : (
                  <Logo title="" />
                )}
              </span>
              <span className="agenda-arrow" aria-hidden="true">→</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function AgendaSkeleton() {
  return (
    <ol className="agenda-list" aria-hidden="true">
      {[0, 1].map((i) => (
        <li key={i}>
          <span className="agenda-row is-skeleton">
            <span className="agenda-index">&nbsp;</span>
            <span className="agenda-date"><span className="agenda-day">&nbsp;</span></span>
            <span className="agenda-main"><span className="agenda-name">&nbsp;</span></span>
            <span className="agenda-thumb" />
          </span>
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------- Ranking

/** Banda clara (corta el ritmo oscuro): el podio de la temporada e invitación al ranking. */
async function RankingTeaser() {
  const { season, rows } = await getPublicPodium()
  if (!season) return null
  return (
    <section className="band-light" aria-labelledby="ranking-title">
      <div className="band-light-inner">
        <div className="band-light-copy reveal">
          <p className="eyebrow">Ranking {season}</p>
          <h2 id="ranking-title" className="section-display">
            El top {PRIZE_POSITIONS} se lleva <em>premio</em>.
          </h2>
          <p className="band-light-text">Cada noche que venís sumás puntos. Al final de la temporada, premiamos a los diez primeros.</p>
          <Link href="/ranking" className="btn btn-ink">Ver ranking</Link>
        </div>
        <div className="band-light-side reveal" aria-hidden={rows.length === 0}>
          {rows.length > 0 ? (
            <RankingList rows={rows} compact />
          ) : (
            <span className="big-outline">{PRIZE_POSITIONS}</span>
          )}
        </div>
      </div>
    </section>
  )
}
