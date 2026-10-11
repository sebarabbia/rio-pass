'use client'

import { useState } from 'react'
import { invitationMessage, whatsappLink } from '@/lib/share'

type Props = {
  url: string
  holderName: string
  phone: string | null
  eventName: string
  when: string
  compact?: boolean
}

/** Botones para mandar el QR: WhatsApp (al número del invitado si lo hay), copiar link y ver. */
export function ShareInvitation({ url, holderName, phone, eventName, when, compact }: Props) {
  const [copied, setCopied] = useState(false)
  const message = invitationMessage({ holderName, eventName, when, url })
  const size = compact ? 'btn-sm' : ''

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
      <a href={whatsappLink(phone, message)} target="_blank" rel="noopener noreferrer" className={`btn btn-primary ${size}`}>
        WhatsApp
      </a>
      <button type="button" onClick={copy} className={`btn btn-secondary ${size}`}>
        {copied ? '¡Copiado!' : 'Copiar link'}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className={`btn btn-ghost ${size}`}>
        Ver QR
      </a>
    </div>
  )
}
