import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from './RegisterForm'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default function RegisterPage() {
  return (
    <div className="page narrow">
      <p className="kicker">Rio Pass</p>
      <h1 className="page-title">Creá tu cuenta</h1>
      <p className="muted page-lead">Es gratis y tarda un minuto. Con tu cuenta vas a ver tus entradas, invitaciones y puntos.</p>
      <RegisterForm />
      <p className="form-footnote">
        ¿Ya tenés cuenta? <Link href="/ingresar">Ingresá</Link>
      </p>
    </div>
  )
}
