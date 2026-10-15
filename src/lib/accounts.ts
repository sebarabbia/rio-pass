import 'server-only'
import type { createClient } from '@/lib/supabase/server'

// Llamadas a la Edge Function "cuentas" (supabase/functions/cuentas): crea cuentas
// sin contraseña con la clave de servicio, que vive solo en Supabase. La persona
// la activa después eligiendo su contraseña en /activar.

type Supabase = Awaited<ReturnType<typeof createClient>>
export type Person = { email: string; full_name?: string; phone?: string | null }
export type BulkStatus = 'creado' | 'actualizado' | 'ya_era_rrpp' | 'otro_perfil' | 'error'
export type BulkResult = { email: string; status: BulkStatus; detail?: string }

/** Se asegura de que exista una cuenta con ese email. Devuelve si la creó. */
export async function ensureAccount(supabase: Supabase, person: Person) {
  const { data, error } = await supabase.functions.invoke<{ id: string; created: boolean }>('cuentas', {
    body: { action: 'ensure', person },
  })
  if (error || !data) throw new Error('No se pudo crear la cuenta')
  return data
}

/** Da de alta (o convierte) RRPP en masa, a cargo de un organizador. Hasta 60 por llamada. */
export async function bulkCreateRrpp(supabase: Supabase, people: Person[], managerId: string) {
  const { data, error } = await supabase.functions.invoke<{ results: BulkResult[] }>('cuentas', {
    body: { action: 'bulk_rrpp', people, manager_id: managerId },
  })
  if (error || !data) throw new Error('No se pudieron cargar los RRPP')
  return data.results
}
