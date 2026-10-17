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
  const paymentId = typeof query.payment_id === 'string' ? query.payment_id : typeof query.collection_id === 'string' ? query.collection_id : null
  if (order.status === 'pendiente' && (paymentId || query.pago === '1')) {
    await syncOrder(supabase, orderId, paymentId && /^\d+$/.test(paymentId) ? paymentId : null)
    order = (await load()).data ?? order
  }

  const { data: tickets } =
    order.status === 'pagado'
      ? await supabase.from('tickets').select('id, code, status, ticket_types(name)').eq('order_id', orderId).order('created_at')
      : { data: [] }

  const event = order.events
  const lastPayment = [...(order.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const rejected = lastPayment?.status === 'rechazado' || query.status === 'rejected' || query.collection_status === 'rejected'
  const expired = hasExpired(order.expires_at)
  const retry = event ? `/eventos/${event.slug}#entradas` : '/'

  let kicker = 'Tu compra'
  let title: React.ReactNode = 'Estamos confirmando tu pago'
  let text = 'Mercado Pago nos avisa en unos segundos. No cierres esta pantalla.'
  let waiting = false
  if (order.status === 'pagado') {
    kicker = 'Compra confirmada'
    title = <>¡Listo, nos <em>vemos</em>!</>
    text = 'Tus entradas ya están en tu cuenta. Sacales una captura: en la playa a veces no hay señal.'
  } else if (order.status === 'reembolsado') {
    title = 'Compra devuelta'
    text = 'Te devolvimos el pago y las entradas quedaron anuladas.'
  } else if (order.status === 'cancelado') {
    title = 'Esta reserva ya no está activa'
    text = 'La reemplazaste por otra compra o se venció. Si pagaste igual, te llega por mail la confirmación de Mercado Pago y la revisamos.'
  } else if (rejected) {
    title = 'El pago no se completó'
    text = 'Mercado Pago lo rechazó. Podés probar de nuevo con otra tarjeta.'
  } else if (expired && !lastPayment) {
    title = 'La reserva venció'
    text = 'Pasaron más de 15 minutos sin pagar y las entradas se liberaron. Podés volver a comprar.'
  } else {
    waiting = true
  }

  return (
    <div className="page narrow order-page">
      {waiting && <AutoRefresh />}
      <p className="kicker">{kicker}</p>
      <h1 className="page-title">{title}</h1>
      <p className="muted page-lead">{text}</p>
      {waiting && <p className="order-waiting" role="status">Actualizando…</p>}

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

      {(rejected || (expired && order.status === 'pendiente' && !lastPayment) || order.status === 'cancelado') && (
        <Link href={retry} className="btn btn-primary btn-block">Volver a comprar</Link>
      )}
      <Link href="/cuenta" className="btn btn-secondary btn-block">Ir a mi cuenta</Link>
    </div>
  )
}
