'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ProfileFormState = { error?: string; message?: string }

const PHONE_RE = /^[+\d][\d\s()-]{5,29}$/

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser()
  if (!user) redirect('/ingresar?next=/cuenta')

  const fullName = String(formData.get('fullName') ?? '').trim().replace(/\s+/g, ' ')
  const phone = String(formData.get('phone') ?? '').trim()

  if (fullName.length < 2 || fullName.length > 80) return { error: 'Escribí tu nombre y apellido.' }
  if (phone && !PHONE_RE.test(phone)) return { error: 'El teléfono solo puede tener números, espacios, + y guiones.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone: phone || null })
    .eq('id', user.id)
  if (error) return { error: 'No pudimos guardar los cambios. Probá de nuevo.' }

  revalidatePath('/cuenta')
  return { message: 'Datos guardados.' }
}
