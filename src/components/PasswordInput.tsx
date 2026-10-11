'use client'

import { useState } from 'react'

type Props = {
  id: string
  name?: string
  autoComplete: 'current-password' | 'new-password'
  minLength?: number
  describedBy?: string
}

/** Campo de contraseña con botón para verla mientras se escribe (útil en el celular). */
export function PasswordInput({ id, name = 'password', autoComplete, minLength, describedBy }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        className="input"
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        minLength={minLength}
        aria-describedby={describedBy}
        required
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={id}
      >
        {visible ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  )
}
