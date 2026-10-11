import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { formatLongDay, formatTime } from '@/lib/format'
import { getOrigin, qrSvg, ticketUrl } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = {
  title: 'Tu QR',
  robots: { index: false, follow: false },
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
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) notFound()

  const { data } = await createPublicClient().rpc('get_ticket_by_code', { _code: code })
  const ticket = data?.[0]
  if (!ticket) notFound()

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
        <p className="muted center-text">
          Mostrá este QR en la puerta. Subí el brillo de la pantalla para que se lea rápido.
        </p>
      )}

      <Link href={`/eventos/${ticket.event_slug}`} className="btn btn-secondary btn-block">
        Ver el evento
      </Link>
    </div>
  )
}
