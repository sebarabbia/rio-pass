import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthSwitchLink } from '@/components/AuthSwitchLink'
import { RegisterForm } from './RegisterForm'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default function RegisterPage() {
  return (
    <div className="page narrow">
      <h1 className="page-title">Creá tu cuenta</h1>
      <p className="muted page-lead">Es gratis y tarda un minuto. Con tu cuenta tenés a mano tus entradas e invitaciones y sumás puntos cada noche.</p>
      <Suspense fallback={<div className="card form-card" aria-hidden="true" style={{ minHeight: 480 }} />}>
        <RegisterForm />
      </Suspense>
      <p className="form-footnote">
        ¿Ya tenés cuenta?{' '}
        <Suspense fallback={<a href="/ingresar">Ingresá</a>}>
          <AuthSwitchLink href="/ingresar">Ingresá</AuthSwitchLink>
        </Suspense>
      </p>
    </div>
  )
}
