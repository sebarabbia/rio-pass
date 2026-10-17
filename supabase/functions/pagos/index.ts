// Rio Pass · Edge Function "pagos" (Mercado Pago Checkout Pro)
//
// Rutas:
//   POST /pagos            acciones de la app, con la sesión del usuario:
//     checkout  reserva el cupo (create_ticket_order) y crea la preferencia de pago
//     sync      vuelve a consultar el pago de un pedido (al volver de Mercado Pago)
//     transfer  pasa una entrada comprada a otra persona (le crea la cuenta si no tiene)
//     refund    devuelve el pago completo de un pedido (solo organizador)
//     status    si Mercado Pago está configurado y en qué modo
//   POST /pagos/webhook    notificaciones de Mercado Pago (URL cargada en el panel de la app)
//
// La fuente de verdad es siempre la API de Mercado Pago: ante cualquier aviso se
// consulta el pago con nuestro Access Token y recién ahí se aplica en la base
// (apply_mp_payment, idempotente). Las credenciales viven solo en los secretos de
// Supabase: MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET, y MP_TEST_MODE=true mientras se usan
// credenciales de prueba (+ SITE_URL opcional).

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? (JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default as string)
const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET') ?? ''
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://rio-pass.vercel.app').replace(/\/$/, '')
const MP_API = 'https://api.mercadopago.com'
// Las credenciales de prueba nuevas también empiezan con APP_USR-: el modo se indica aparte.
const TEST_MODE = Deno.env.get('MP_TEST_MODE') === 'true' || MP_TOKEN.startsWith('TEST-')

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class AppError extends Error {
  constructor(public code: string, public status = 400) {
    super(code)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// ---------------------------------------------------------------- Mercado Pago

async function mp<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  if (!MP_TOKEN) throw new AppError('mp_no_configurado', 503)
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    // Que una demora de Mercado Pago no cuelgue la pantalla (ni pase los 22 s del webhook).
    signal: AbortSignal.timeout(10_000),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('Mercado Pago', res.status, path, text.slice(0, 500))
    throw new AppError(res.status === 404 ? 'pago_inexistente' : 'mp_error', res.status === 404 ? 404 : 502)
  }
  return (text ? JSON.parse(text) : {}) as T
}

type MpPayment = { id: number; status: string; external_reference: string | null } & Record<string, unknown>

/** Consulta el pago en Mercado Pago y lo aplica en la base. */
async function applyPayment(paymentId: string | number) {
  const payment = await mp<MpPayment>(`/v1/payments/${encodeURIComponent(String(paymentId))}`)
  const { data, error } = await admin.rpc('apply_mp_payment', { _payment: payment })
  if (error) {
    console.error('apply_mp_payment', error)
    throw new AppError('db_error', 500)
  }
  return { payment, result: data as Record<string, unknown> }
}

/** "2027-01-15T23:30:00.000-03:00" (formato que pide Mercado Pago para las fechas de la preferencia). */
function mpDate(date: Date) {
  const ar = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  return ar.toISOString().replace('Z', '-03:00')
}

// ---------------------------------------------------------------- Webhook

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Firma de Mercado Pago (header x-signature: "ts=...,v1=...").
 * Manifiesto: "id:{data.id};request-id:{x-request-id};ts:{ts};" (se omite lo que no viene;
 * el data.id alfanumérico va en minúsculas). HMAC-SHA256 en hex con la clave secreta.
 */
async function validSignature(req: Request, dataId: string | null) {
  const header = req.headers.get('x-signature')
  if (!header || !MP_WEBHOOK_SECRET) return null // sin firma para verificar
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=', 2) as [string, string]))
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false
  const requestId = req.headers.get('x-request-id')
  let manifest = ''
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(MP_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  return safeEqual(signature, v1.toLowerCase())
}

async function handleWebhook(req: Request) {
  const url = new URL(req.url)
  let body: Record<string, unknown> | null = null
  try {
    body = await req.json()
  } catch {
    body = null
  }
  // Dos formatos: Webhooks (?data.id=…&type=payment, firmado) e IPN (?id=…&topic=payment, sin firma validable).
  const webhookId = url.searchParams.get('data.id') ?? ((body?.data as { id?: string } | undefined)?.id ?? null)
  const ipnId = url.searchParams.get('id')
  const type = url.searchParams.get('type') ?? (body?.type as string | undefined) ?? url.searchParams.get('topic')
  const paymentId = webhookId ?? ipnId

  // Solo nos importan los pagos (merchant_order y otros avisos se ignoran).
  if (type !== 'payment' || !paymentId || !/^\d+$/.test(String(paymentId))) return json({ ignored: true })

  // La firma se controla y se registra, pero nunca se confía en el contenido del aviso:
  // el pago siempre se consulta en la API de Mercado Pago con nuestro token. Así, un
  // aviso falso no puede emitir entradas, y una clave mal cargada no deja a nadie sin
  // sus QR (los pagos se siguen aplicando).
  if (webhookId) {
    const signature = await validSignature(req, url.searchParams.get('data.id') ?? webhookId)
    if (signature === false) console.warn('Aviso con firma inválida (¿MP_WEBHOOK_SECRET?). Se consulta igual en la API:', paymentId)
  }

  try {
    const { result } = await applyPayment(paymentId)
    return json({ ok: true, result })
  } catch (err) {
    // 404 de un pago que no es nuestro (o un "Simular" del panel): 200 para que no se reintente.
    if (err instanceof AppError && err.code === 'pago_inexistente') return json({ ignored: true })
    // Cualquier otro error: 500 para que Mercado Pago reintente más tarde.
    console.error('webhook', err)
    return json({ error: 'reintentar' }, 500)
  }
}

// ---------------------------------------------------------------- Acciones de la app

async function currentUser(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data } = await admin.auth.getUser(token)
  if (!data?.user) throw new AppError('sin_sesion', 401)
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', data.user.id)
  return { id: data.user.id, isOrganizer: (roles ?? []).some((r) => r.role === 'organizador') }
}

type OrderDraft = {
  superseded_preferences?: string[]
  order_id: string
  total: number
  expires_at: string
  event_name: string
  buyer_email: string | null
  buyer_name: string | null
  items: { ticket_type_id: string; name: string; quantity: number; unit_price: number }[]
}

async function checkout(userId: string, eventId: unknown, items: unknown) {
  if (!MP_TOKEN) throw new AppError('mp_no_configurado', 503)
  if (typeof eventId !== 'string' || !UUID_RE.test(eventId) || !Array.isArray(items)) throw new AppError('pedido_vacio')

  const { data, error } = await admin.rpc('create_ticket_order', { _buyer: userId, _event_id: eventId, _items: items })
  if (error) throw new AppError(error.message?.match(/^[a-z_]+$/) ? error.message : 'pedido_invalido')
  const order = data as OrderDraft

  const back = `${SITE_URL}/compra/${order.order_id}?pago=1`
  const preference = {
    items: order.items.map((i) => ({
      id: i.ticket_type_id,
      title: `${order.event_name} · ${i.name}`.slice(0, 250),
      category_id: 'tickets',
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      currency_id: 'ARS',
    })),
    // En modo prueba el comprador tiene que ser un usuario de prueba: no se manda el email real.
    ...(TEST_MODE ? {} : { payer: { email: order.buyer_email ?? undefined, name: order.buyer_name ?? undefined } }),
    external_reference: order.order_id,
    // Sin notification_url: los avisos llegan a la URL cargada en el panel de Mercado Pago
    // (Webhooks), que es la que firma y la única que avisa los pagos de prueba.
    back_urls: { success: back, failure: back, pending: back },
    auto_return: 'approved',
    statement_descriptor: 'RIO PASS',
    // Pago inmediato (aprobado o rechazado, sin "pendiente"): la reserva dura 15 minutos.
    binary_mode: true,
    expires: true,
    expiration_date_from: mpDate(new Date(Date.now() - 60_000)),
    expiration_date_to: mpDate(new Date(order.expires_at)),
    // Sin efectivo (Rapipago/Pago Fácil) ni cajero: se acreditan tarde y la reserva ya venció.
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
    metadata: { order_id: order.order_id },
  }

  let created: { id: string; init_point: string }
  try {
    created = await mp<{ id: string; init_point: string }>('/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `pref-${order.order_id}` },
      body: JSON.stringify(preference),
    })
  } catch (err) {
    // Si Mercado Pago no creó el pago, se libera la reserva al toque (no 15 minutos después).
    await admin.from('orders').update({ status: 'cancelado' }).eq('id', order.order_id).eq('status', 'pendiente')
    throw err
  }
  await admin.from('orders').update({ mp_preference_id: created.id }).eq('id', order.order_id)
  // Las reservas anteriores de esta persona ya se liberaron: se vencen sus pagos en
  // Mercado Pago para que no se paguen sin cupo (si falla, queda el aviso "sin_cupo").
  await Promise.allSettled(
    (order.superseded_preferences ?? []).map((id) =>
      mp(`/checkout/preferences/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ expires: true, expiration_date_to: mpDate(new Date()) }),
      }),
    ),
  )
  // init_point sirve tanto con credenciales de prueba como de producción (sandbox_init_point ya no se usa).
  return { order_id: order.order_id, init_point: created.init_point }
}

async function loadOrder(orderId: unknown, user: { id: string; isOrganizer: boolean }) {
  if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) throw new AppError('pedido_inexistente', 404)
  const { data: order } = await admin.from('orders').select('id, user_id, status').eq('id', orderId).maybeSingle()
  if (!order || (order.user_id !== user.id && !user.isOrganizer)) throw new AppError('pedido_inexistente', 404)
  return order
}

async function sync(user: { id: string; isOrganizer: boolean }, orderId: unknown, paymentId: unknown) {
  const order = await loadOrder(orderId, user)
  if (typeof paymentId === 'string' && /^\d+$/.test(paymentId)) {
    const payment = await mp<MpPayment>(`/v1/payments/${paymentId}`)
    // El pago tiene que ser de este pedido (no se puede aplicar uno ajeno).
    if (payment.external_reference === order.id) await admin.rpc('apply_mp_payment', { _payment: payment })
  } else {
    const found = await mp<{ results?: MpPayment[] }>(
      `/v1/payments/search?external_reference=${order.id}&sort=date_created&criteria=desc&limit=10`,
    )
    // Del más viejo al más nuevo; cada uno se consulta de nuevo (la búsqueda puede estar desactualizada).
    for (const payment of [...(found.results ?? [])].reverse()) {
      if (payment.external_reference === order.id) await applyPayment(payment.id)
    }
  }
  const { data: updated } = await admin.from('orders').select('status').eq('id', order.id).single()
  return { order_status: updated?.status ?? order.status }
}

async function refund(user: { id: string; isOrganizer: boolean }, orderId: unknown) {
  if (!user.isOrganizer) throw new AppError('sin_permiso', 403)
  const order = await loadOrder(orderId, user)
  const { data: payments } = await admin
    .from('payments')
    .select('provider_payment_id')
    .eq('order_id', order.id)
    .eq('status', 'aprobado')
  if (!payments?.length) throw new AppError('sin_pago_aprobado')
  // Se devuelven todos los pagos aprobados del pedido (si hubo un pago duplicado, también).
  for (const { provider_payment_id: paymentId } of payments) {
    if (!paymentId) continue
    await mp(`/v1/payments/${paymentId}/refunds`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `refund-${paymentId}` },
      body: JSON.stringify({}),
    })
    await applyPayment(paymentId)
  }
  const { data: updated } = await admin.from('orders').select('status').eq('id', order.id).single()
  return { order_status: updated?.status }
}

/** Cuenta con ese email; si no existe, se crea sin contraseña (la activa en /activar). */
async function ensureAccount(email: string) {
  const found = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (found.data) return found.data.id as string
  // El nombre lo escribe otra persona: queda solo en la entrada, no como nombre de la cuenta.
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) {
    const again = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
    if (again.data) return again.data.id as string
    throw new AppError('destinatario_sin_cuenta')
  }
  return data.user.id
}

async function transfer(userId: string, ticketId: unknown, emailRaw: unknown, nameRaw: unknown) {
  const email = String(emailRaw ?? '').trim().toLowerCase()
  const name = String(nameRaw ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
  if (typeof ticketId !== 'string' || !UUID_RE.test(ticketId)) throw new AppError('entrada_no_transferible')
  if (!EMAIL_RE.test(email)) throw new AppError('email_invalido')

  // Antes de crear una cuenta, se verifica que la entrada sea suya y se pueda pasar.
  const { data: ticket } = await admin
    .from('tickets')
    .select('id, user_id, kind, status, order_id, events(starts_at)')
    .eq('id', ticketId)
    .maybeSingle()
  if (!ticket || ticket.user_id !== userId || ticket.kind !== 'entrada' || !ticket.order_id) throw new AppError('entrada_no_transferible')
  if (ticket.status !== 'valido') throw new AppError('entrada_no_valida')
  const startsAt = (ticket.events as { starts_at?: string } | null)?.starts_at
  if (!startsAt || new Date(startsAt).getTime() < Date.now() - 6 * 60 * 60 * 1000) throw new AppError('evento_pasado')

  await ensureAccount(email)
  const { error } = await admin.rpc('transfer_ticket', { _ticket_id: ticketId, _from: userId, _to_email: email, _to_name: name })
  if (error) throw new AppError(error.message?.match(/^[a-z_]+$/) ? error.message : 'entrada_no_transferible')
  return { ticket_id: ticketId }
}

// ---------------------------------------------------------------- Router

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (url.pathname.endsWith('/webhook')) {
    if (req.method !== 'POST') return json({ ok: true })
    return handleWebhook(req)
  }
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)

  try {
    const user = await currentUser(req)
    const body = await req.json().catch(() => ({}))
    switch (body.action) {
      case 'status':
        return json({ configured: Boolean(MP_TOKEN), test_mode: TEST_MODE })
      case 'checkout':
        return json(await checkout(user.id, body.event_id, body.items))
      case 'sync':
        return json(await sync(user, body.order_id, body.payment_id))
      case 'refund':
        return json(await refund(user, body.order_id))
      case 'transfer':
        return json(await transfer(user.id, body.ticket_id, body.email, body.name))
      default:
        return json({ error: 'accion_invalida' }, 400)
    }
  } catch (err) {
    if (err instanceof AppError) return json({ error: err.code }, err.status)
    console.error(err)
    return json({ error: 'error' }, 500)
  }
})
