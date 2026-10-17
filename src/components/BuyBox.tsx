'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { buyTickets } from '@/actions/sales'
import { formatMoney } from '@/lib/format'

type Offer = { ticket_type_id: string; name: string; price: number; available: number | null; on_sale: boolean }

const MAX = 6

/** Elegir sectores y cantidades y pagar con Mercado Pago (Checkout Pro). */
export function BuyBox({ eventSlug, eventId, offer, loggedIn }: { eventSlug: string; eventId: string; offer: Offer[]; loggedIn: boolean }) {
  const router = useRouter()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [redirecting, setRedirecting] = useState(false)

  const count = Object.values(qty).reduce((a, b) => a + b, 0)
  const total = offer.reduce((sum, o) => sum + (qty[o.ticket_type_id] ?? 0) * o.price, 0)
  const anyOnSale = offer.some((o) => o.on_sale && o.available !== 0)
  const loginHref = `/ingresar?next=${encodeURIComponent(`/eventos/${eventSlug}#entradas`)}`

  function change(id: string, delta: number, max: number) {
    setError(null)
    setQty((prev) => {
      const next = Math.min(Math.max((prev[id] ?? 0) + delta, 0), max)
      return { ...prev, [id]: next }
    })
  }

  function buy() {
    setError(null)
    startTransition(async () => {
      const items = Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }))
      const result = await buyTickets(eventId, items)
      if (result.url) {
        setRedirecting(true)
        window.location.href = result.url
        return
      }
      if (result.needsLogin) {
        router.push(loginHref)
        return
      }
      setError(result.error ?? 'No se pudo iniciar el pago.')
    })
  }

  return (
    <section className="buy" id="entradas" aria-labelledby="buy-title">
      <h2 id="buy-title" className="buy-title">
        <em>Entradas</em>
      </h2>
      <ul className="buy-list">
        {offer.map((o) => {
          const soldOut = o.available === 0
          const selected = qty[o.ticket_type_id] ?? 0
          const room = MAX - count + selected
          const max = Math.min(room, o.available ?? MAX)
          const disabled = !o.on_sale || soldOut
          return (
            <li key={o.ticket_type_id} className={`buy-row${disabled ? ' is-off' : ''}`}>
              <div className="buy-info">
                <p className="buy-name">{o.name}</p>
                <p className="buy-meta">
                  <span className="buy-price">{formatMoney(o.price)}</span>
                  {soldOut ? (
                    <span className="buy-badge is-out">Agotado</span>
                  ) : !o.on_sale ? (
                    <span className="buy-badge">No disponible ahora</span>
                  ) : o.available !== null && o.available <= 20 ? (
                    <span className="buy-badge is-low">Quedan {o.available}</span>
                  ) : null}
                </p>
              </div>
              {!disabled && (
                <div className="stepper" role="group" aria-label={`Cantidad de ${o.name}`}>
                  <button type="button" onClick={() => change(o.ticket_type_id, -1, max)} disabled={selected === 0 || pending} aria-label="Una menos">
                    −
                  </button>
                  <output aria-live="polite">{selected}</output>
                  <button type="button" onClick={() => change(o.ticket_type_id, 1, max)} disabled={selected >= max || pending} aria-label="Una más">
                    +
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {anyOnSale && (
        <div className="buy-foot">
          <p className="buy-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </p>
          {loggedIn ? (
            <button type="button" className="btn btn-primary btn-block" onClick={buy} disabled={count === 0 || pending || redirecting} aria-busy={pending || redirecting}>
              {redirecting ? 'Yendo a Mercado Pago…' : pending ? 'Reservando…' : count === 0 ? 'Elegí tus entradas' : `Pagar ${count} ${count === 1 ? 'entrada' : 'entradas'}`}
            </button>
          ) : (
            <Link href={loginHref} className="btn btn-primary btn-block">Ingresá para comprar</Link>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="buy-note">
            Pagás en Mercado Pago con tarjeta o dinero en cuenta. Te reservamos las entradas 15 minutos y los QR quedan en tu
            cuenta. Hasta {MAX} por compra.
          </p>
        </div>
      )}
    </section>
  )
}
