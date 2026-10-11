import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/auth-errors'
import { createClient } from '@/lib/supabase/server'

/**
 * Destino del link de confirmación que manda Supabase por mail.
 * Soporta los dos formatos: `?code=` (plantilla por defecto, flujo PKCE) y
 * `?token_hash=&type=` (plantilla personalizada, funciona desde cualquier dispositivo).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  const next = safeNext(params.get('next'))

  const supabase = await createClient()
  let ok = false
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
  }

  const destination = request.nextUrl.clone()
  destination.search = ''
  if (ok) {
    destination.pathname = next
  } else {
    destination.pathname = '/ingresar'
    destination.searchParams.set('error', 'link')
  }
  return NextResponse.redirect(destination)
}
