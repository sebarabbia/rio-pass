'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, hasRole, type AppRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const ASSIGNABLE: AppRole[] = ['rrpp', 'acreditador', 'barra', 'organizador']

export async function toggleRole(formData: FormData) {
  const me = await getCurrentUser()
  if (!me) redirect('/ingresar?next=/organizador/usuarios')
  if (!hasRole(me, 'organizador')) throw new Error('Solo un organizador puede cambiar roles.')

  const userId = String(formData.get('userId') ?? '')
  const role = String(formData.get('role') ?? '') as AppRole
  const enable = formData.get('enable') === '1'
  if (!userId || !ASSIGNABLE.includes(role)) return
  // Evita quedarse sin acceso al panel por error.
  if (userId === me.id && role === 'organizador' && !enable) return

  const supabase = await createClient()
  if (enable) {
    await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role', ignoreDuplicates: true })
  } else {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
  }
  revalidatePath('/organizador/usuarios')
}
