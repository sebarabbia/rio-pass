'use server'

import { revalidatePath } from 'next/cache'
import { fromLocalDateTime } from '@/lib/format'
import { requireOrganizer } from '@/lib/organizer'

const UUID_RE = /^[0-9a-f-]{36}$/

/** Precio, cupo online y ventana de venta de un sector. */
export async function updateTicketType(formData: FormData) {
  const supabase = await requireOrganizer()
  const id = String(formData.get('id') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  // El input es numérico ("5000" o "5000.5"); por las dudas se acepta coma decimal.
  const price = Number(String(formData.get('price') ?? '').trim().replace(',', '.') || '0')
  const quantityRaw = String(formData.get('quantity') ?? '').trim()
  const quantity = quantityRaw === '' ? null : Number(quantityRaw)
  const startsRaw = String(formData.get('salesStart') ?? '')
  const endsRaw = String(formData.get('salesEnd') ?? '')
  const salesStart = startsRaw ? fromLocalDateTime(startsRaw) : null
  const salesEnd = endsRaw ? fromLocalDateTime(endsRaw) : null

  if (!UUID_RE.test(id) || !UUID_RE.test(eventId)) throw new Error('Datos inválidos')
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw new Error('Precio inválido')
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0 || quantity > 100_000)) throw new Error('Cupo inválido')
  if ((startsRaw && !salesStart) || (endsRaw && !salesEnd)) throw new Error('Fecha inválida')
  if (salesStart && salesEnd && salesEnd <= salesStart) throw new Error('El fin de la venta tiene que ser después del inicio')

  const { error } = await supabase
    .from('ticket_types')
    .update({ price, quantity, sales_start_at: salesStart, sales_end_at: salesEnd })
    .eq('id', id)
    .eq('event_id', eventId)
  if (error) throw new Error('No se pudo guardar')
  revalidatePath(`/organizador/eventos/${eventId}/ventas`)
}
