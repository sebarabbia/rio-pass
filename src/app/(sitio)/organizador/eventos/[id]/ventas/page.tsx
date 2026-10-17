import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { recheckPurchase, refundPurchase } from '@/actions/sales'
import { ActionForm } from '@/components/ActionForm'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { formatMoney, formatShortDay, formatTime, toLocalDateTime } from '@/lib/format'
import { hasExpired, paymentsStatus } from '@/lib/sales'
import { createClient } from '@/lib/supabase/server'
import { updateTicketType } from './actions'

export const metadata: Metadata = { title: 'Ventas' }

type Props = PageProps<'/organizador/eventos/[id]/ventas'>

const ORDER_STATUS = { pendiente: 'Pendiente', pagado: 'Pagado', entregado: 'Entregado', cancelado: 'Cancelado', reembolsado: 'Devuelto' } as const
const ORDER_PILL = { pendiente: 'pill-muted', pagado: 'pill-ok', entregado: 'pill-ok', cancelado: 'pill-muted', reembolsado: 'pill-bad' } as const
const ATTENTION: Record<string, string> = {
  sin_cupo: 'Se pagó cuando ya no había cupo: decidí si la devolvés.',
  monto_distinto: 'El monto pagado no coincide: no se emitieron QR. Revisalo en Mercado Pago.',
  reembolso_con_uso: 'Se devolvió pero alguna entrada ya se había usado.',
  pago_duplicado: 'Pagó dos veces la misma compra: devolvé uno de los pagos desde Mercado Pago.',
  en_disputa: 'El comprador abrió una disputa en Mercado Pago: respondela desde tu cuenta de Mercado Pago.',
  contracargo: 'Hubo un contracargo: se anularon los QR sin usar.',
  reembolso_parcial: 'Mercado Pago registra una devolución parcial: revisá qué entradas anular.',
  sin_sector: 'El sector de esta compra ya no existe: no se emitieron QR. Devolvé el pago.',
}
const ORDER_EXPIRED = 'Vencida'

export default function SalesPage(props: Props) {
  return (
    <Suspense fallback={<PageLoading label="Cargando ventas…" />}>
      <Sales {...props} />
    </Suspense>
  )
}

async function Sales({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const me = await requireUser(`/organizador/eventos/${id}/ventas`)
  if (!hasRole(me, 'organizador')) notFound()
  const showAll = query.ver === 'todos'

  const supabase = await createClient()
  let ordersQuery = supabase
    .from('orders')
    .select('id, status, total, attention, created_at, paid_at, expires_at, buyer:profiles!orders_user_id_fkey(full_name, email), order_items(name, quantity), payments(id)')
    .eq('event_id', id)
    .eq('kind', 'entradas')
    .order('created_at', { ascending: false })
    .limit(200)
  if (!showAll) ordersQuery = ordersQuery.in('status', ['pagado', 'reembolsado', 'pendiente'])

  const [{ data: event }, { data: summary }, { data: types }, { data: orders }, mp] = await Promise.all([
    supabase.from('events').select('id, name, starts_at').eq('id', id).maybeSingle(),
    supabase.rpc('event_sales_summary', { _event_id: id }),
    supabase.from('ticket_types').select('id, name, price, quantity, sales_start_at, sales_end_at').eq('event_id', id).eq('is_active', true).order('sort_order'),
    ordersQuery,
    paymentsStatus(supabase),
  ])
  if (!event) notFound()

  const stats = new Map((summary ?? []).map((s) => [s.ticket_type_id, s]))
  const revenue = (summary ?? []).reduce((sum, s) => sum + Number(s.revenue), 0)
  const sold = (summary ?? []).reduce((sum, s) => sum + s.sold, 0)
  const reserved = (summary ?? []).reduce((sum, s) => sum + s.reserved, 0)
  const when = `${formatShortDay(event.starts_at)} ${formatTime(event.starts_at)} h`
  // Reservas que vencieron sin ningún pago: no son compras (se ven con "Ver también canceladas").
  const visibleOrders = (orders ?? []).filter(
    (o) => showAll || !(o.status === 'pendiente' && hasExpired(o.expires_at) && o.payments.length === 0),
  )
  const alerts = (orders ?? []).filter((o) => o.attention)

  return (
    <div className="page wide">
      <Link href="/organizador" className="back-link">← Eventos</Link>
      <p className="kicker">{when}</p>
      <h1 className="page-title">
        Ventas · <em>{event.name}</em>
      </h1>

      {mp.ok && mp.configured ? (
        <p className={`mp-status${mp.test_mode ? ' is-test' : ''}`}>
          Mercado Pago conectado{mp.test_mode ? ' · modo prueba (los pagos no son reales)' : ''}
        </p>
      ) : (
        <div className="card notice mp-missing">
          <p className="card-title">Falta conectar Mercado Pago</p>
          <p className="muted">
            Podés dejar los precios cargados, pero hasta que se configuren las credenciales la web no deja comprar. Los pasos
            están en el README (sección “Mercado Pago”).
          </p>
        </div>
      )}

      <div className="stats">
        <div className="stat"><b>{formatMoney(revenue)}</b><span>Recaudado</span></div>
        <div className="stat"><b>{sold}</b><span>Vendidas</span></div>
        <div className="stat"><b>{reserved}</b><span>Reservadas ahora</span></div>
      </div>

      {alerts.length > 0 && (
        <div className="card notice sales-alerts" role="alert">
          <p className="card-title">Para revisar ({alerts.length})</p>
          <ul>
            {alerts.map((o) => (
              <li key={o.id} className="muted small">
                {o.buyer?.full_name || o.buyer?.email}: {ATTENTION[o.attention ?? ''] ?? o.attention}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="h-sectores">
        <h2 id="h-sectores" className="block-title">Sectores a la venta</h2>
        <p className="muted small">
          Un sector se vende online si tiene precio (mayor a 0). El cupo es cuántas entradas se venden por la web (vacío = sin
          límite). Sin fechas, se vende desde ya hasta 4 h después de que empieza la fecha. Los sectores se crean editando el evento.
        </p>
        <ul className="list admin-grid">
          {types?.map((t) => {
            const s = stats.get(t.id)
            const available = t.quantity === null ? null : Math.max(0, t.quantity - (s?.sold ?? 0) - (s?.reserved ?? 0))
            return (
              <li key={t.id} className="card sector-card">
                <div className="row">
                  <p className="card-title">{t.name}</p>
                  <span className={`pill ${s?.on_sale ? 'pill-ok' : 'pill-muted'}`}>{s?.on_sale ? 'A la venta' : 'Sin venta'}</span>
                </div>
                <p className="muted small">
                  {s?.sold ?? 0} vendidas · {s?.reserved ?? 0} reservadas
                  {available !== null ? ` · quedan ${available}` : ''} · {formatMoney(s?.revenue ?? 0)}
                </p>
                <ActionForm action={updateTicketType} success={`${t.name}: guardado`} error="Revisá los datos del sector." className="sector-form">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <div className="field-row two">
                    <div className="field">
                      <label htmlFor={`price-${t.id}`}>Precio (ARS)</label>
                      <input id={`price-${t.id}`} name="price" type="text" inputMode="decimal" className="input" defaultValue={Number(t.price) ? formatMoney(t.price).replace(/[^\d.,]/g, '') : ''} placeholder="Ej.: 5.000 (vacío = no se vende)" />
                    </div>
                    <div className="field">
                      <label htmlFor={`qty-${t.id}`}>Cupo online</label>
                      <input id={`qty-${t.id}`} name="quantity" type="number" inputMode="numeric" min={0} className="input" defaultValue={t.quantity ?? ''} placeholder="Sin límite" />
                    </div>
                  </div>
                  <div className="field-row two">
                    <div className="field">
                      <label htmlFor={`start-${t.id}`}>Empieza <span className="optional">(opcional)</span></label>
                      <input id={`start-${t.id}`} name="salesStart" type="datetime-local" className="input" defaultValue={toLocalDateTime(t.sales_start_at)} />
                    </div>
                    <div className="field">
                      <label htmlFor={`end-${t.id}`}>Termina <span className="optional">(opcional)</span></label>
                      <input id={`end-${t.id}`} name="salesEnd" type="datetime-local" className="input" defaultValue={toLocalDateTime(t.sales_end_at)} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-secondary btn-sm">Guardar</button>
                </ActionForm>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="h-pedidos">
        <div className="row">
          <h2 id="h-pedidos" className="block-title">Compras</h2>
          <Link href={showAll ? '?' : '?ver=todos'} className="link-hint">{showAll ? 'Ocultar canceladas y vencidas' : 'Ver también canceladas y vencidas'}</Link>
        </div>
        {!visibleOrders.length ? (
          <div className="empty">
            <p className="empty-title">Todavía no hay compras</p>
            <p>Cuando alguien compre por la web, aparece acá.</p>
          </div>
        ) : (
          <ul className="list">
            {visibleOrders.map((o) => {
              const expired = o.status === 'pendiente' && hasExpired(o.expires_at)
              return (
              <li key={o.id} className={`card order-row${o.attention ? ' has-attention' : ''}`}>
                <div className="row">
                  <div className="invitation-info">
                    <p className="card-title">{o.buyer?.full_name || 'Sin nombre'}</p>
                    <p className="muted small">
                      {[o.buyer?.email, o.order_items.map((i) => `${i.quantity} × ${i.name}`).join(', '), formatShortDay(o.created_at) + ' ' + formatTime(o.created_at)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span className="order-amount">{formatMoney(o.total)}</span>
                </div>
                <div className="invitation-actions">
                  <span className={`pill ${expired ? 'pill-muted' : ORDER_PILL[o.status]}`}>{expired ? ORDER_EXPIRED : ORDER_STATUS[o.status]}</span>
                  {o.attention && <span className="pill pill-bad">Revisar</span>}
                  {o.status === 'pagado' && (
                    <ActionForm action={refundPurchase} success="Devolución pedida a Mercado Pago" error="No se pudo devolver. Revisalo en Mercado Pago.">
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="eventId" value={event.id} />
                      <ConfirmSubmit message={`¿Devolver ${formatMoney(o.total)} a ${o.buyer?.full_name || 'esta persona'}? Sus QR sin usar se anulan.`} className="btn btn-danger btn-sm">
                        Devolver
                      </ConfirmSubmit>
                    </ActionForm>
                  )}
                  {((o.status === 'pendiente' && o.payments.length > 0) || o.attention) && (
                    <ActionForm action={recheckPurchase} success="Pago revisado" error="Mercado Pago no respondió.">
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="eventId" value={event.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">Revisar pago</button>
                    </ActionForm>
                  )}
                </div>
              </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
