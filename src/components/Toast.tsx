'use client'

import { useSyncExternalStore } from 'react'

// Avisos cortos ("Listo") para confirmar acciones del panel. Un store mínimo en
// memoria: cualquier componente cliente llama toast() y <Toaster /> los muestra.

type ToastItem = { id: number; text: string; tone: 'ok' | 'error' }

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const EMPTY: ToastItem[] = []

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function toast(text: string, tone: ToastItem['tone'] = 'ok') {
  const id = nextId++
  items = [...items.slice(-2), { id, text, tone }]
  emit()
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, 2800)
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY)
  return (
    <div className="toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <p key={t.id} className={`toast is-${t.tone}`}>
          {t.tone === 'ok' ? '✓ ' : ''}
          {t.text}
        </p>
      ))}
    </div>
  )
}
