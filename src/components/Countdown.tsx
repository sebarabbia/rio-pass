'use client'

import { useSyncExternalStore } from 'react'

// Reloj de minutos sin Date.now() en el render (se calcula en el navegador).
const subscribe = (cb: () => void) => {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
const getMinute = () => Math.floor(Date.now() / 60_000)
const getServerMinute = () => 0

const DAY = 24 * 60 * 60 * 1000
const AR = 'America/Argentina/Buenos_Aires'
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: AR, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "Faltan 12 días" / "Mañana" / "Es hoy" / "Es esta noche", según la fecha real del evento. */
export function Countdown({ startsAt, className }: { startsAt: string; className?: string }) {
  const minute = useSyncExternalStore(subscribe, getMinute, getServerMinute)
  if (minute === 0) return null // en el servidor no se sabe la hora del celular: se muestra al cargar
  const now = minute * 60_000
  const start = new Date(startsAt).getTime()
  if (now > start + 10 * 60 * 60 * 1000) return null
  // Diferencia en días calendario de Argentina (no en horas).
  const days = Math.round((Date.parse(dayKey.format(start)) - Date.parse(dayKey.format(now))) / DAY)
  const text =
    now >= start ? 'Es esta noche' : days <= 0 ? 'Es hoy' : days === 1 ? 'Es mañana' : `Faltan ${days} días`
  return <span className={className}>{text}</span>
}
