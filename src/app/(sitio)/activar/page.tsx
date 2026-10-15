import type { Metadata } from 'next'
import Link from 'next/link'
import { RecoverForm } from '../recuperar/RecoverForm'

export const metadata: Metadata = { title: 'Activar cuenta' }

// Para quien tiene cuenta creada por Rio (RRPP dados de alta en masa o invitados
// a quienes se les creó al regalarles un QR): elige su contraseña por mail.
export default function ActivatePage() {
  return (
    <div className="page narrow">
      <h1 className="page-title">Activá tu cuenta</h1>
      <p className="muted page-lead">
        Si te regalaron un QR o te dieron de alta en Rio Pass, tu cuenta ya existe. Escribí tu email y te mandamos un link
        para elegir tu contraseña.
      </p>
      <RecoverForm submitLabel="Mandarme el link" />
      <p className="form-footnote">
        ¿Ya tenés contraseña? <Link href="/ingresar">Ingresá</Link>
      </p>
    </div>
  )
}
