'use client'

import { useFormStatus } from 'react-dom'

/** Botón de envío que pide confirmación antes de una acción irreversible. */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault()
      }}
    >
      {pending ? '…' : children}
    </button>
  )
}
