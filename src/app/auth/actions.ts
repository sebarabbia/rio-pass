'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { authErrorMessage, safeNext } from '@/lib/auth-errors'
import { createClient } from '@/lib/supabase/server'

export type AuthFormState = {
  error?: string
  message?: string
  fields?: { email?: string; fullName?: string; phone?: string }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s()-]{5,29}$/

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const next = safeNext(formData.get('next'))

  if (!email || !password) return { error: 'Completá tu email y tu contraseña.', fields: { email } }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: authErrorMessage(error), fields: { email } }

  redirect(next)
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeNext(formData.get('next'))
  const fullName = String(formData.get('fullName') ?? '').trim().replace(/\s+/g, ' ')
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const phone = String(formData.get('phone') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const fields = { fullName, email, phone }

  if (fullName.length < 2 || fullName.length > 80) return { error: 'Escribí tu nombre y apellido.', fields }
  if (!EMAIL_RE.test(email)) return { error: 'Ese email no parece válido.', fields }
  if (phone && !PHONE_RE.test(phone)) return { error: 'El teléfono solo puede tener números, espacios, + y guiones.', fields }
  if (password.length < 8) return { error: 'La contraseña tiene que tener al menos 8 caracteres.', fields }

  const origin = (await headers()).get('origin') ?? 'http://localhost:3000'
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El trigger de la base copia estos datos al perfil y le da el rol "cliente".
      data: { full_name: fullName, phone: phone || null },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  })
  if (error) return { error: authErrorMessage(error), fields }

  // Si el proyecto no exige confirmar el email, la sesión ya está abierta.
  if (data.session) redirect(next)

  return {
    message: `¡Listo! Te mandamos un mail a ${email} para confirmar tu cuenta. Abrí el link desde este mismo dispositivo.`,
  }
}

/**
 * Manda el mail para elegir una contraseña nueva. Siempre responde lo mismo,
 * exista o no la cuenta, para no revelar qué emails están registrados.
 */
export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: 'Escribí el email con el que te registraste.', fields: { email } }

  const origin = (await headers()).get('origin') ?? 'http://localhost:3000'
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/cuenta/contrasena')}`,
  })
  if (error && (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit')) {
    return { error: authErrorMessage(error), fields: { email } }
  }
  return {
    message: `Si hay una cuenta con ${email}, te llega un mail con un link para elegir una contraseña nueva. Abrilo desde este mismo celular. Si no lo ves, revisá la carpeta de spam.`,
  }
}

/** Cambia la contraseña del usuario logueado (también al volver del mail de recuperación). */
export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8) return { error: 'La contraseña tiene que tener al menos 8 caracteres.' }
  if (password !== confirm) return { error: 'Las dos contraseñas no coinciden.' }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect('/ingresar?next=/cuenta/contrasena')

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    if (error.code === 'same_password') return { error: 'Es la misma contraseña que ya tenías. Elegí otra.' }
    return { error: authErrorMessage(error) }
  }
  return { message: 'Listo, tu contraseña nueva ya funciona.' }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
