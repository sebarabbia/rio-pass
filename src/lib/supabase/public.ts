import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/config'

/**
 * Cliente anónimo, sin cookies: para datos públicos (eventos publicados) dentro
 * de funciones con 'use cache', que no pueden leer la sesión. Ve exactamente lo
 * mismo que un visitante sin cuenta.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
