import type { AuthError } from '@supabase/supabase-js'

/** Solo permite volver a rutas internas (evita redirecciones a otros sitios). */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = '/cuenta') {
  const next = typeof value === 'string' ? value : ''
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  // "/\\otro.com" o con tabs/saltos el navegador los toma como otro sitio: se resuelve
  // contra un origen ficticio y solo se acepta si queda en ese mismo origen.
  try {
    const url = new URL(next, 'https://rio.invalid')
    if (url.origin !== 'https://rio.invalid') return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}

/** Traduce los errores de Supabase Auth a mensajes claros en español. */
export function authErrorMessage(error: AuthError) {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email o contraseña incorrectos.'
    case 'email_not_confirmed':
      return 'Todavía no confirmaste tu email. Revisá tu casilla (y la carpeta de spam).'
    case 'user_already_exists':
    case 'email_exists':
      return 'Ya hay una cuenta con ese email. Ingresá con tu contraseña.'
    case 'weak_password':
      return 'La contraseña es muy débil. Usá al menos 8 caracteres, mezclando letras y números.'
    case 'email_address_invalid':
      return 'Ese email no parece válido.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Hubo demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.'
    case 'same_password':
      return 'Es la misma contraseña que ya tenías. Elegí otra.'
    case 'reauthentication_needed':
      return 'Por seguridad, volvé a ingresar y probá de nuevo.'
    case 'signup_disabled':
      return 'El registro está deshabilitado por el momento.'
    default:
      return 'No pudimos completar la operación. Probá de nuevo en un rato.'
  }
}
