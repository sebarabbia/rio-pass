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
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const proto = h.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Link público de un QR: es lo que se manda por WhatsApp y lo que codifica el QR. */
export function ticketUrl(origin: string, code: string) {
  return `${origin}/qr/${code}`
}

/** QR en SVG (negro sobre blanco, con margen) listo para insertar en la página. */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } })
}
