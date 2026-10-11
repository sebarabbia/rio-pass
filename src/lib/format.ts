// Rio está en Paraná (Entre Ríos): todas las fechas se muestran y se cargan en
// hora de Argentina, sin importar la zona horaria del celular o del servidor.
export const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const AR_OFFSET = '-03:00' // Argentina no usa horario de verano.

const dayFormat = new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })
const longFormat = new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "sáb 20 dic" */
export function formatShortDay(iso: string) {
  return dayFormat.format(new Date(iso)).replace(/\./g, '')
}

/** "sábado, 20 de diciembre de 2026" */
export function formatLongDay(iso: string) {
  return longFormat.format(new Date(iso))
}

/** "23:30" */
export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso))
}

/** ISO -> { date: "2026-12-20", time: "23:30" } en hora argentina (para inputs). */
export function toLocalInputs(iso: string) {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** "2026-12-20" + "23:30" (hora argentina) -> ISO con zona. */
export function fromLocalInputs(date: string, time: string) {
  return new Date(`${date}T${time}:00${AR_OFFSET}`).toISOString()
}

/** "Apertura de Temporada!" -> "apertura-de-temporada" */
export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? ''
}
