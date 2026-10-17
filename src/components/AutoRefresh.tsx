'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Vuelve a pedir la página cada unos segundos (mientras se confirma un pago).
 * Si se agotan los intentos, muestra doneText en lugar de "Actualizando…".
 */
export function AutoRefresh({ every = 4000, times = 20, doneText }: { every?: number; times?: number; doneText?: string }) {
  const router = useRouter()
  const [done, setDone] = useState(false)
  useEffect(() => {
    let count = 0
    const id = window.setInterval(() => {
      count += 1
      router.refresh()
      if (count >= times) {
        window.clearInterval(id)
        setDone(true)
      }
    }, every)
    return () => window.clearInterval(id)
  }, [router, every, times])
  if (done) return doneText ? <p className="muted" role="status">{doneText}</p> : null
  return <p className="order-waiting" role="status">Actualizando…</p>
}
