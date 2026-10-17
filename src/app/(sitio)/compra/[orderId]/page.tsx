import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AutoRefresh } from '@/components/AutoRefresh'
import { PageLoading } from '@/components/PageStates'
import { requireUser } from '@/lib/auth'
import { formatLongDay, formatMoney, formatTime } from '@/lib/format'
import { hasExpired, syncOrder } from '@/lib/sales'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Tu compra', robots: { index: false, follow: false } }

type Props = PageProps<'/compra/[orderId]'>

export default function OrderPage(props: Props) {
  return (
    <Suspense fallback={<PageLoading label="Buscando tu compra…" />}>
      <Order {...props} />
    </Suspense>
  )
}

const UUID_RE = /^[0-9a-f-]{36}$/

async function Order({ params, searchParams }: Props) {
  const [{ orderId }, query] = await Promise.all([params, searchParams])
  if (!UUID_RE.test(orderId)) notFound()
  await requireUser(`/compra/${orderId}`)
  const supabase = await createClient()

  const load = () =>
    supabase
      .from('orders')
      .select('id, status, total, expires_at, created_at, events(name, slug, starts_at), order_items(name, quantity, unit_price), payments(status, created_at)')
      .eq('id', orderId)
      .maybeSingle()
  let { data: order } = await load()
  if (!order) notFound()

  // Volviendo de Mercado Pago: se consulta el pago al toque, sin esperar la notificación.
  // Solo mientras el pedido todavía no tiene pagos registrados (los refrescos siguientes leen la base).
  const rawPaymentId = typeof query.payment_id === 'string' ? query.payment_id : typeof query.collection_id === 'string' ? query.collection_id : null
  const paymentId = rawPaymentId && /^\d+$/.test(rawPaymentId) ? rawPaymentId : null
  const mpStatus = typeof query.status === 'string' ? query.status : typeof query.collection_status === 'string' ? query.collection_status : null
  const returned = query.pago === '1' || !!paymentId
  if ((order.status === 'pendiente' || order.status === 'cancelado') && returned && (order.payments ?? []).length === 0) {
    await syncOrder(supabase, orderId, paymentId)
    order = (await load()).data ?? order
  }

  const { data: tickets } =
    order.status === 'pagado'
      ? await supabase.from('tickets').select('id, code, status, ticket_types(name)').eq('order_id', orderId).order('created_at')
      : { data: [] }

  const event = order.events
  const lastPayment = [...(order.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const paidButReview = lastPayment?.status === 'aprobado' && order.status !== 'pagado' && order.status !== 'reembolsado'
  const rejected = lastPayment?.status === 'rechazado' || (!lastPayment && mpStatus === 'rejected')
  // Volvió sin pagar (cerró el checkout o tocó "Volver al sitio").
  const abandoned = !lastPayment && returned && !paymentId && (mpStatus === null || mpStatus === 'null')
  const expired = hasExpired(order.expires_at)
  const retry = event ? `/eventos/${event.slug}#entradas` : '/'

  let kicker = 'Tu compra'
  let title: React.ReactNode = 'Estamos confirmando tu pago'
  let text = 'Mercado Pago nos avisa en unos segundos. No cierres esta pantalla.'
  let waiting = false
  let canRetry = false
  if (order.status === 'pagado') {
    kicker = 'Compra confirmada'
    title = <>¡Listo, nos <em>vemos</em>!</>
    text = 'Tus entradas ya están en tu cuenta. Sacales una captura: en la playa a veces no hay señal.'
  } else if (order.status === 'reembolsado') {
    title = 'Compra devuelta'
    text = 'Te devolvimos el pago y las entradas quedaron anuladas.'
  } else if (paidButReview) {
    title = 'Recibimos tu pago'
    text = 'Lo estamos revisando y te avisamos. Si tenés dudas, escribinos con el número de operación de Mercado Pago.'
  } else if (rejected) {
    title = 'El pago no se completó'
    text = 'Mercado Pago lo rechazó. Podés probar de nuevo con otra tarjeta.'
    canRetry = true
  } else if (abandoned) {
    title = 'No completaste el pago'
    text = expired
      ? 'La reserva ya se venció. Podés volver a comprar.'
      : 'Tus entradas siguen reservadas unos minutos. Podés volver a intentarlo.'
    canRetry = true
  } else if (order.status === 'cancelado' && mpStatus !== 'approved') {
    title = 'Esta reserva ya no está activa'
    text = 'La reemplazaste por otra compra o se venció. Si pagaste igual, te llega por mail la confirmación de Mercado Pago y la revisamos.'
    canRetry = true
  } else if (expired && !lastPayment && mpStatus !== 'approved') {
    title = 'La reserva venció'
    text = 'Pasaron más de 15 minutos sin pagar y las entradas se liberaron. Podés volver a comprar.'
    canRetry = true
  } else {
    waiting = true
  }

  return (
    <div className="page narrow order-page">
      <p className="kicker">{kicker}</p>
      <h1 className="page-title">{title}</h1>
      <p className="muted page-lead">{text}</p>
      {waiting && <AutoRefresh doneText="Todavía no nos llegó la confirmación. Apenas llegue, tus entradas aparecen en Mi cuenta." />}

      <section className="card order-summary" aria-label="Detalle de la compra">
        {event && (
          <p className="order-event">
            <strong>{event.name}</strong>
            <span className="muted">
              {formatLongDay(event.starts_at)} · {formatTime(event.starts_at)} h
            </span>
          </p>
        )}
        <ul className="order-lines">
          {order.order_items.map((item, i) => (
            <li key={i}>
              <span>
                {item.quantity} × {item.name}
              </span>
              <span>{formatMoney(Number(item.unit_price) * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="order-total">
          <span>Total</span>
          <strong>{formatMoney(order.total)}</strong>
        </p>
      </section>

      {tickets && tickets.length > 0 && (
        <section aria-labelledby="tus-entradas">
          <h2 id="tus-entradas" className="block-title">Tus entradas</h2>
          <ul className="list">
            {tickets.map((t, i) => (
              <li key={t.id}>
                <Link href={`/qr/${t.code}`} className="card row link-card">
                  <span>
                    <span className="card-title">Entrada {i + 1}</span>
                    <span className="muted small"> · {t.ticket_types?.name}</span>
                  </span>
                  <span className="link-hint">Ver QR →</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="muted small">¿Compraste para alguien más? En <Link href="/cuenta">Mi cuenta</Link> podés pasarle cada entrada a su email.</p>
        </section>
      )}

      {canRetry && <Link href={retry} className="btn btn-primary btn-block">Volver a comprar</Link>}
      <Link href="/cuenta" className="btn btn-secondary btn-block">Ir a mi cuenta</Link>
    </div>
  )
}
