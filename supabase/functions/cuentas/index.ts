// Rio Pass · Edge Function "cuentas"
// Crea cuentas sin contraseña para que cada QR quede asociado a una persona:
//  - action "ensure": un RRPP u organizador regala un QR a un email sin cuenta.
//  - action "bulk_rrpp": un organizador da de alta RRPP en masa (con su responsable).
// La persona después activa su cuenta eligiendo contraseña en /activar.
// Usa la clave de servicio (solo existe acá, nunca en el navegador) y verifica
// por dentro quién llama y con qué perfil.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? (JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default as string)

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s()-]{5,29}$/
const MAX_BULK = 60

type Person = { email: string; full_name?: string; phone?: string | null }
type RowResult = { email: string; status: 'creado' | 'actualizado' | 'ya_era_rrpp' | 'otro_perfil' | 'error'; detail?: string }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function clean(p: Person) {
  const email = String(p.email ?? '').trim().toLowerCase()
  const full_name = String(p.full_name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
  const phoneRaw = String(p.phone ?? '').trim()
  const phone = phoneRaw && PHONE_RE.test(phoneRaw) ? phoneRaw.slice(0, 30) : null
  return { email, full_name, phone }
}

/** Devuelve el id de la cuenta con ese email; si no existe, la crea (sin contraseña). */
async function ensureAccount(db: SupabaseClient, person: Person) {
  const { email, full_name, phone } = clean(person)
  if (!EMAIL_RE.test(email)) throw new Error('email_invalido')

  const found = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  if (found.data) return { id: found.data.id as string, created: false }

  const { data, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true, // la cuenta queda lista; la persona elige su contraseña al activarla
    user_metadata: { full_name, phone },
  })
  if (error) {
    // Pudo crearse en paralelo: se busca de nuevo.
    const again = await db.from('profiles').select('id').eq('email', email).maybeSingle()
    if (again.data) return { id: again.data.id as string, created: false }
    throw new Error(error.message)
  }
  return { id: data.user.id, created: true }
}

async function makeRrpp(db: SupabaseClient, person: Person, managerId: string): Promise<RowResult> {
  const { email } = clean(person)
  try {
    const { id, created } = await ensureAccount(db, person)
    const { data: roles } = await db.from('user_roles').select('role').eq('user_id', id)
    const staff = (roles ?? []).map((r) => r.role as string).filter((r) => r !== 'cliente')
    if (staff.some((r) => r !== 'rrpp')) return { email, status: 'otro_perfil', detail: staff.join(', ') }

    const wasRrpp = staff.includes('rrpp')
    if (!wasRrpp) {
      const { error } = await db.from('user_roles').insert({ user_id: id, role: 'rrpp', granted_by: managerId })
      if (error) throw new Error(error.message)
    }
    await db.from('profiles').update({ manager_id: managerId }).eq('id', id)
    return { email, status: created ? 'creado' : wasRrpp ? 'ya_era_rrpp' : 'actualizado' }
  } catch (err) {
    return { email, status: 'error', detail: err instanceof Error ? err.message : String(err) }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)

  // Quién llama (la sesión del usuario en la app).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  const caller = auth?.user
  if (!caller) return json({ error: 'sin_sesion' }, 401)

  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', caller.id)
  const isOrga = (roles ?? []).some((r) => r.role === 'organizador')
  const isRrpp = (roles ?? []).some((r) => r.role === 'rrpp')

  let body: { action?: string; person?: Person; people?: Person[]; manager_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'json_invalido' }, 400)
  }

  if (body.action === 'ensure') {
    if (!isOrga && !isRrpp) return json({ error: 'sin_permiso' }, 403)
    try {
      return json(await ensureAccount(admin, body.person ?? { email: '' }))
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'error' }, 400)
    }
  }

  if (body.action === 'bulk_rrpp') {
    if (!isOrga) return json({ error: 'sin_permiso' }, 403)
    const people = (body.people ?? []).slice(0, MAX_BULK)
    const managerId = body.manager_id ?? caller.id
    const { data: managerRole } = await admin.from('user_roles').select('role').eq('user_id', managerId).eq('role', 'organizador').maybeSingle()
    if (!managerRole) return json({ error: 'responsable_invalido' }, 400)

    // De a 6 en paralelo: rápido sin saturar la API de Auth.
    const results: RowResult[] = []
    for (let i = 0; i < people.length; i += 6) {
      results.push(...(await Promise.all(people.slice(i, i + 6).map((p) => makeRrpp(admin, p, managerId)))))
    }
    return json({ results })
  }

  return json({ error: 'accion_invalida' }, 400)
})
