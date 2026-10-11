import type { Metadata } from 'next'
import Link from 'next/link'
import { cache, Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { formatLongDay, formatTime } from '@/lib/format'
import { getOrigin, qrSvg, ticketUrl } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'

const CODE_RE = /^[A-Za-z0-9_-]{16,64}$/

// Se usa en la metadata (vista previa de WhatsApp) y en la página: una sola consulta por request.
const getTicket = cache(async (code: string) => {
  if (!CODE_RE.test(code)) return null
  const { data } = await createPublicClient().rpc('get_ticket_by_code', { _code: code })
  return data?.[0] ?? null
})

export async function generateMetadata({ params }: PageProps<'/qr/[code]'>): Promise<Metadata> {
  const { code } = await params
  const ticket = await getTicket(code)
  const robots = { index: false, follow: false }
  if (!ticket) return { title: 'QR no encontrado', robots }
  const kind = ticket.kind === 'invitacion' ? 'Invitación' : 'Entrada'
  const title = `${kind} · ${ticket.event_name}`
  const description = `${ticket.holder_name ? `${ticket.holder_name}: ` : ''}${formatLongDay(ticket.event_starts_at)} · ${formatTime(ticket.event_starts_at)} h · ${ticket.event_venue}. Mostrá tu QR en la puerta.`
  return { title, description, robots, openGraph: { title, description }, twitter: { title, description } }
}

export default function TicketPage({ params }: PageProps<'/qr/[code]'>) {
  return (
    <Suspense fallback={<PageLoading label="Cargando tu QR…" />}>
      <Ticket params={params} />
    </Suspense>
  )
}

const STATUS_BANNER = {
  usado: 'Este QR ya se usó para ingresar.',
  anulado: 'Este QR fue anulado y no permite el ingreso.',
} as const

async function Ticket({ params }: { params: PageProps<'/qr/[code]'>['params'] }) {
  const { code } = await params
  const ticket = await getTicket(code)
  if (!ticket) return <TicketMissing />

  const origin = await getOrigin()
  const svg = await qrSvg(ticketUrl(origin, code))
  const valid = ticket.status === 'valido'

  return (
    <div className="page ticket-page">
      <p className="kicker">{ticket.kind === 'invitacion' ? 'Invitación sin cargo' : 'Entrada'}</p>
      <h1 className="page-title">{ticket.event_name}</h1>
      <p className="ticket-when">
        {formatLongDay(ticket.event_starts_at)} · {formatTime(ticket.event_starts_at)} h
        <br />
        {ticket.event_venue}
      </p>

      {!valid && (
        <p className="ticket-banner" role="alert">
          {STATUS_BANNER[ticket.status as 'usado' | 'anulado']}
        </p>
      )}

      <div className={`ticket-card${valid ? '' : ' is-invalid'}`}>
        <div className="ticket-qr" role="img" aria-label="Código QR de ingreso" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="ticket-holder">{ticket.holder_name}</p>
        {ticket.sector && <p className="ticket-sector">{ticket.sector}</p>}
      </div>

      {valid && (
        <div className="ticket-tips">
          <p><strong>Sacale una captura ahora.</strong> En la playa a veces no hay señal y la captura sirve igual.</p>
          <p className="muted">En la puerta, subí el brillo de la pantalla para que se lea rápido.</p>
        </div>
      )}

      <Link href={`/eventos/${ticket.event_slug}`} className="btn btn-secondary btn-block">
        Ver el evento
      </Link>
      <p className="muted small center-text">
        Con cuenta en Rio Pass sumás puntos cada noche que venís y entrás al <Link href="/ranking">ranking</Link>.{' '}
        <Link href="/registro">Creá tu cuenta</Link>.
      </p>
    </div>
  )
}

/** Link roto o incompleto (pasa al copiarlo a mano): se explica qué hacer en vez de un 404 genérico. */
function TicketMissing() {
  return (
    <div className="page center">
      <p className="kicker">QR no encontrado</p>
      <h1 className="page-title">Este QR no existe</h1>
      <p className="muted">Puede que el link esté incompleto (pasa al copiarlo a mano). Pedile a quien te lo mandó que te lo reenvíe.</p>
      <Link href="/" className="btn btn-primary">Ver próximas fechas</Link>
    </div>
  )
}
