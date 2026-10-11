'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/** true si el navegador tiene el menú nativo de compartir (celulares, Safari). */
export function useCanShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false,
  )
}
