'use client'

import { useState } from 'react'
import { useCanShare } from '@/hooks/useCanShare'
import { whatsappLink } from '@/lib/share'

/** Compartir una fecha: WhatsApp directo y el menú del celular (Instagram, Telegram…) o copiar el link. */
export function ShareEvent({ url, title, text }: { url: string; title: string; text: string }) {
  const canShare = useCanShare()
  const [copied, setCopied] = useState(false)

  async function share() {
    try {
      await navigator.share({ title, text, url })
    } catch {
      /* el usuario cerró el menú */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copiá el link:', url)
    }
  }

  return (
    <div className="share-actions">
      <a href={whatsappLink(null, `${text}\n${url}`)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
        Compartir por WhatsApp
      </a>
      {canShare ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={share}>Más opciones</button>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>{copied ? '¡Copiado!' : 'Copiar link'}</button>
      )}
    </div>
  )
}
