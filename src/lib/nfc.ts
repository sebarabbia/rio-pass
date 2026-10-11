// Lectura de tarjetas NFC con Web NFC (solo Chrome en Android, sobre HTTPS).
// Se lee únicamente el número de serie (UID) de la tarjeta: nunca se escribe.

type NdefReadingEvent = Event & { serialNumber?: string }
type NdefReader = EventTarget & { scan(options?: { signal?: AbortSignal }): Promise<void> }
type NdefWindow = Window & { NDEFReader?: new () => NdefReader }

export function nfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

/** "04:91:58:0a:8c:19:90" o "0491580A8C1990" -> "04:91:58:0A:8C:19:90" (4 a 10 bytes), o null. */
export function normalizeUid(raw: string | null | undefined) {
  const hex = String(raw ?? '').toUpperCase().replace(/[\s:.\-]/g, '')
  if (!/^[0-9A-F]+$/.test(hex) || hex.length % 2 || hex.length < 8 || hex.length > 20) return null
  return hex.match(/../g)!.join(':')
}

export function nfcErrorMessage(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
      return 'Permiso de NFC denegado. Tocá el ícono a la izquierda de la dirección → Permisos → NFC → Permitir.'
    case 'NotSupportedError':
      return 'Este celular no tiene NFC o no es compatible.'
    case 'NotReadableError':
      return 'El NFC está apagado. Activalo en Ajustes → Conexiones → NFC.'
    default:
      return 'No se pudo activar el lector NFC. Probá de nuevo.'
  }
}

/**
 * Empieza a escuchar tarjetas hasta que se aborte la señal. Llama a onRead con el
 * UID (sin normalizar) de cada tarjeta que se apoye. Lanza si no se pudo activar.
 */
export async function startNfcScan(onRead: (uid: string) => void, onReadError: () => void, signal: AbortSignal) {
  const Reader = (window as NdefWindow).NDEFReader
  if (!Reader) throw Object.assign(new Error('NFC no disponible'), { name: 'NotSupportedError' })
  const reader = new Reader()
  reader.addEventListener('reading', (e) => {
    if (!signal.aborted) onRead((e as NdefReadingEvent).serialNumber ?? '')
  })
  reader.addEventListener('readingerror', () => {
    if (!signal.aborted) onReadError()
  })
  await reader.scan({ signal })
}
