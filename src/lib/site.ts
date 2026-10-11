import 'server-only'
import { headers } from 'next/headers'
import QRCode from 'qrcode'

/**
 * URL base del sitio para armar links absolutos (QR, WhatsApp). En producción
 * conviene fijarla con NEXT_PUBLIC_SITE_URL; si no, se deduce del request.
 * Lee headers: usarla dentro de un <Suspense> o en una acción.
 */
export async function getOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  // En producción en Vercel: siempre el dominio público (rio-pass.vercel.app o el propio),
  // aunque se entre por otra URL de Vercel (que puede pedir login).
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const proto = h.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * Igual que getOrigin pero sin leer el request (sirve en páginas cacheadas y en
 * metadataBase). En local devuelve localhost.
 */
export function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/** Link público de un QR: es lo que se manda por WhatsApp y lo que codifica el QR. */
export function ticketUrl(origin: string, code: string) {
  return `${origin}/qr/${code}`
}

/** QR en SVG (negro sobre blanco, con margen) listo para insertar en la página. */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } })
}
