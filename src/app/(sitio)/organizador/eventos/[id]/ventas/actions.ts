'use server'

import { revalidatePath } from 'next/cache'
import { fromLocalDateTime } from '@/lib/format'
import { requireOrganizer } from '@/lib/organizer'

const UUID_RE = /^[0-9a-f-]{36}$/

/**
 * Precio escrito a la argentina o "de máquina": "5.000" y "5000" son cinco mil,
 * "5.000,50" y "5000.50" son cinco mil con cincuenta. Devuelve NaN si no se entiende.
 */
function parsePrice(raw: string) {
  const value = raw.replace(/[\s$]/g, '')
  if (value === '') return 0
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) return Number(value.replace(/\./g, '').replace(',', '.'))
  if (/^\d+(,\d{1,2})?$/.test(value)) return Number(value.replace(',', '.'))
  if (/^\d+(\.\d{1,2})?$/.test(value)) return Number(value)
  return Number.NaN
}

/** Precio, cupo online y ventana de venta de un sector. */
export async function updateTicketType(formData: FormData): Promise<{ error?: string } | void> {
  const supabase = await requireOrganizer()
  const id = String(formData.get('id') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  const price = parsePrice(String(formData.get('price') ?? ''))
  const quantityRaw = String(formData.get('quantity') ?? '').trim()
  const quantity = quantityRaw === '' ? null : Number(quantityRaw)
  const startsRaw = String(formData.get('salesStart') ?? '')
  const endsRaw = String(formData.get('salesEnd') ?? '')
  const salesStart = startsRaw ? fromLocalDateTime(startsRaw) : null
  const salesEnd = endsRaw ? fromLocalDateTime(endsRaw) : null

  if (!UUID_RE.test(id) || !UUID_RE.test(eventId)) return { error: 'Datos inválidos. Recargá la página.' }
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { error: 'No se entiende el precio. Escribilo así: 5000 o 5.000.' }
  if (price > 0 && price < 100) return { error: `¿Seguro que la entrada vale $ ${price}? Si son miles, escribilo completo: ${price}000.` }
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0 || quantity > 100_000)) return { error: 'El cupo tiene que ser un número entero (o vacío para no tener límite).' }
  if ((startsRaw && !salesStart) || (endsRaw && !salesEnd)) return { error: 'Revisá las fechas de la venta.' }
  if (salesStart && salesEnd && salesEnd <= salesStart) return { error: 'El fin de la venta tiene que ser después del inicio.' }

  const { error } = await supabase
    .from('ticket_types')
    .update({ price, quantity, sales_start_at: salesStart, sales_end_at: salesEnd })
    .eq('id', id)
    .eq('event_id', eventId)
  if (error) return { error: 'No se pudo guardar. Probá de nuevo.' }
  revalidatePath(`/organizador/eventos/${eventId}/ventas`)
}
