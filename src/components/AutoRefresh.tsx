'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Vuelve a pedir la página cada unos segundos (mientras se confirma un pago). */
export function AutoRefresh({ every = 4000, times = 20 }: { every?: number; times?: number }) {
  const router = useRouter()
  useEffect(() => {
    let count = 0
    const id = window.setInterval(() => {
      count += 1
      router.refresh()
      if (count >= times) window.clearInterval(id)
    }, every)
    return () => window.clearInterval(id)
  }, [router, every, times])
  return null
}
