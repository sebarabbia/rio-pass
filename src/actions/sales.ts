'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { MAX_PER_ORDER, refundOrder, salesErrorMessage, startCheckout, syncOrder, transferTicket } from '@/lib/sales'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f-]{36}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CheckoutResult = { url?: string; error?: string; needsLogin?: boolean }

/** Reserva las entradas y devuelve el link de pago de Mercado Pago. */
export async function buyTickets(eventId: string, items: { ticket_type_id: string; quantity: number }[]): Promise<CheckoutResult> {
  const user = await getCurrentUser()
  if (!user) return { needsLogin: true, error: salesErrorMessage('sin_sesion') }
  if (!UUID_RE.test(eventId)) return { error: salesErrorMessage('evento_no_disponible') }

  const clean = items
    .filter((i) => UUID_RE.test(i.ticket_type_id) && Number.isInteger(i.quantity) && i.quantity > 0)
    .map((i) => ({ ticket_type_id: i.ticket_type_id, quantity: i.quantity }))
  const count = clean.reduce((sum, i) => sum + i.quantity, 0)
  if (count === 0) return { error: salesErrorMessage('pedido_vacio') }
  if (count > MAX_PER_ORDER) return { error: salesErrorMessage('maximo_por_compra') }

  const supabase = await createClient()
  const result = await startCheckout(supabase, eventId, clean)
  if (!result.ok) return { error: salesErrorMessage(result.error) }
  return { url: result.init_point }
}

export type TransferState = { error?: string; message?: string }

/** Pasa una entrada comprada a otra persona (si no tiene cuenta, se le crea). */
export async function transferPurchasedTicket(_prev: TransferState, formData: FormData): Promise<TransferState> {
  if (!(await getCurrentUser())) return { error: salesErrorMessage('sin_sesion') }
  const ticketId = String(formData.get('ticketId') ?? '')
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!UUID_RE.test(ticketId)) return { error: salesErrorMessage('entrada_no_transferible') }
  if (name.length < 2) return { error: 'Escribí el nombre de la persona.' }
  if (!EMAIL_RE.test(email)) return { error: salesErrorMessage('email_invalido') }

  const supabase = await createClient()
  const result = await transferTicket(supabase, ticketId, email, name)
  if (!result.ok) return { error: salesErrorMessage(result.error) }
  revalidatePath('/cuenta')
  return { message: `Listo: la entrada ahora es de ${name}. Le llega a su cuenta (${email}); tu QR anterior ya no sirve.` }
}

async function requireOrganizerClient() {
  const user = await getCurrentUser()
  if (!user || !hasRole(user, 'organizador')) throw new Error(salesErrorMessage('sin_permiso'))
  return createClient()
}

/** Devuelve el pago completo de un pedido (organizador). Los QR sin usar se anulan. */
export async function refundPurchase(formData: FormData) {
  const supabase = await requireOrganizerClient()
  const orderId = String(formData.get('orderId') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  if (!UUID_RE.test(orderId)) throw new Error('Pedido inválido')
  const result = await refundOrder(supabase, orderId)
  if (!result.ok) throw new Error(salesErrorMessage(result.error))
  revalidatePath(`/organizador/eventos/${eventId}/ventas`)
}

/** Vuelve a consultar el pago en Mercado Pago (por si una notificación no llegó). */
export async function recheckPurchase(formData: FormData) {
  const supabase = await requireOrganizerClient()
  const orderId = String(formData.get('orderId') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  if (!UUID_RE.test(orderId)) throw new Error('Pedido inválido')
  const result = await syncOrder(supabase, orderId)
  if (!result.ok) throw new Error(salesErrorMessage(result.error))
  revalidatePath(`/organizador/eventos/${eventId}/ventas`)
}
