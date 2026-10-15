// Armado de mensajes y links para compartir invitaciones (sirve en cliente y servidor).

/**
 * Número para wa.me en formato internacional sin "+". Para celulares argentinos
 * cargados como "343 456 7890" (10 dígitos) agrega 549. Si no hay número, null
 * (wa.me abre WhatsApp para elegir el contacto).
 */
export function whatsappNumber(phone: string | null | undefined) {
  let digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.startsWith('54')) return digits
  if (digits.length === 10) return `549${digits}`
  return digits
}

export function invitationMessage({ holderName, eventName, when, url }: { holderName: string; eventName: string; when: string; url: string }) {
  const name = holderName.trim().split(/\s+/)[0]
  const origin = new URL(url).origin
  return [
    `¡Hola ${name}! Te dejo tu QR sin cargo para ${eventName} (${when}) en Rio.`,
    url,
    'Abrilo y sacale una captura (en la playa a veces no hay señal). Mostralo en la puerta.',
    `Tu QR también queda en tu cuenta de Rio Pass: activala con tu email en ${origin}/activar y sumá puntos cada noche.`,
  ].join('\n')
}

export function whatsappLink(phone: string | null | undefined, text: string) {
  const number = whatsappNumber(phone)
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`
}
