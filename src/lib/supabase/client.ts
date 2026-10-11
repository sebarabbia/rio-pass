import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/config'

/** Cliente de Supabase para Client Components (usa la sesión del navegador). */
export function createClient() {
  return createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  )
}
