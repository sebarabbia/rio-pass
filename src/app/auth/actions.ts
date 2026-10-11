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
      emailRedirectTo: `${origin}/auth/confirm?next=/cuenta`,
    },
  })
  if (error) return { error: authErrorMessage(error), fields }

  // Si el proyecto no exige confirmar el email, la sesión ya está abierta.
  if (data.session) redirect('/cuenta')

  return {
    message: `¡Listo! Te mandamos un mail a ${email} para confirmar tu cuenta. Abrí el link desde este mismo dispositivo.`,
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
