import 'server-only'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import type { createClient } from '@/lib/supabase/server'

// Venta de entradas: todo lo que mueve plata pasa por la Edge Function "pagos"
// (supabase/functions/pagos), que tiene las credenciales de Mercado Pago y la
// clave de servicio. Desde acá solo se le pide cosas con la sesión del usuario.

type Supabase = Awaited<ReturnType<typeof createClient>>

export const MAX_PER_ORDER = 6

export type OfferItem = { ticket_type_id: string; name: string; price: number; available: number | null; on_sale: boolean }

/** Sectores a la venta de una fecha, con disponibilidad al momento (una consulta por request). */
export const getTicketOffer = cache(async (eventId: string): Promise<OfferItem[]> => {
  const { data } = await createPublicClient().rpc('event_ticket_offer', { _event_id: eventId })
  return (data ?? []).map((o) => ({ ...o, price: Number(o.price) }))
})

// Mensajes de los errores que devuelven la función y la base.
const ERRORS: Record<string, string> = {
  sin_sesion: 'Ingresá a tu cuenta para comprar.',
  demasiados_intentos: 'Hiciste varios intentos de compra seguidos. Esperá un rato y probá de nuevo.',
  mp_no_configurado: 'La venta online todavía no está habilitada. Probá más tarde.',
  evento_no_disponible: 'Esta fecha ya no está a la venta.',
  sector_no_disponible: 'Ese sector no está a la venta en este momento.',
  sin_cupo: 'No quedan suficientes entradas en ese sector. Probá con menos o con otro sector.',
  maximo_por_compra: `Podés comprar hasta ${MAX_PER_ORDER} entradas por compra.`,
  cantidad_invalida: 'Elegí cuántas entradas querés.',
  pedido_vacio: 'Elegí al menos una entrada.',
  entrada_no_transferible: 'Esa entrada no se puede pasar.',
  entrada_no_valida: 'Esa entrada ya se usó o fue anulada.',
  evento_pasado: 'La fecha ya pasó.',
  destinatario_sin_cuenta: 'No se pudo crear la cuenta de esa persona. Revisá el email.',
  mismo_destinatario: 'Esa entrada ya es tuya.',
  ya_tiene_qr: 'Esa persona ya tiene un QR para esta fecha.',
  email_invalido: 'Ese email no parece válido.',
  sin_permiso: 'No tenés permiso para hacer esto.',
  sin_pago_aprobado: 'Este pedido no tiene un pago aprobado para devolver.',
  mp_error: 'Mercado Pago no respondió. Probá de nuevo en un rato.',
}

export function salesErrorMessage(code: string | undefined) {
  return (code && ERRORS[code]) || 'No se pudo completar la operación. Probá de nuevo.'
}

type PagosResponse<T> = ({ ok: true } & T) | { ok: false; error: string }

async function callPagos<T>(supabase: Supabase, body: Record<string, unknown>): Promise<PagosResponse<T>> {
  const { data, error } = await supabase.functions.invoke('pagos', { body, timeout: 15_000 })
  if (error) {
    // Los errores "esperables" vienen en el cuerpo con status 4xx.
    let code = 'mp_error'
    try {
      const context = (error as { context?: Response }).context
      const payload = context ? await context.json() : null
      if (payload?.error) code = payload.error
    } catch {
      /* sin cuerpo */
    }
    return { ok: false, error: code }
  }
  return { ok: true, ...(data as T) }
}

export function startCheckout(supabase: Supabase, eventId: string, items: { ticket_type_id: string; quantity: number }[]) {
  return callPagos<{ order_id: string; init_point: string }>(supabase, { action: 'checkout', event_id: eventId, items })
}

export function syncOrder(supabase: Supabase, orderId: string, paymentId?: string | null) {
  return callPagos<{ order_status: string }>(supabase, { action: 'sync', order_id: orderId, payment_id: paymentId ?? null })
}

export function transferTicket(supabase: Supabase, ticketId: string, email: string, name: string) {
  return callPagos<{ ticket_id: string }>(supabase, { action: 'transfer', ticket_id: ticketId, email, name })
}

export function refundOrder(supabase: Supabase, orderId: string) {
  return callPagos<{ order_status: string }>(supabase, { action: 'refund', order_id: orderId })
}

export function paymentsStatus(supabase: Supabase) {
  return callPagos<{ configured: boolean; test_mode: boolean }>(supabase, { action: 'status' })
}

/** ¿Ya pasó esta fecha/hora? (fuera del render para no usar Date.now() en componentes) */
export function hasExpired(iso: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now()
}

/** Desde cuándo se revisan solos los pedidos sin confirmar: un pago se puede hacer
 *  hasta 15 minutos después de reservar, así que alcanza con la última media hora. */
export function recentOrdersSince() {
  return new Date(Date.now() - 30 * 60 * 1000).toISOString()
}

export function nowIso() {
  return new Date().toISOString()
}
