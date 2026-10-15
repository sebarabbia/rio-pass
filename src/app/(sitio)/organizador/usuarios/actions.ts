'use server'

import { revalidatePath } from 'next/cache'
import type { AppRole } from '@/lib/auth'
import { requireOrganizer } from '@/lib/organizer'

const PROFILES: AppRole[] = ['cliente', 'rrpp', 'acreditador', 'organizador']
const UUID_RE = /^[0-9a-f-]{36}$/

const ERRORS: Record<string, string> = {
  no_podes_quitarte: 'No podés quitarte tu propio perfil de organizador.',
  usuario_inexistente: 'Ese usuario ya no existe.',
}

/** Cambia el perfil de una persona: cada uno tiene uno solo (y todos conservan lo de cliente). */
export async function setProfile(formData: FormData) {
  const supabase = await requireOrganizer()
  const userId = String(formData.get('userId') ?? '')
  const profile = String(formData.get('profile') ?? '') as AppRole
  if (!UUID_RE.test(userId) || !PROFILES.includes(profile)) throw new Error('Datos inválidos')

  const { error } = await supabase.rpc('set_user_profile', { _user_id: userId, _profile: profile })
  if (error) throw new Error(ERRORS[error.message] ?? 'No se pudo cambiar el perfil.')
  revalidatePath('/organizador/usuarios')
  revalidatePath('/organizador/rrpp')
}
