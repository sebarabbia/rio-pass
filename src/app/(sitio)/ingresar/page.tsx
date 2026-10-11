import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthSwitchLink } from '@/components/AuthSwitchLink'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Ingresar' }

export default function LoginPage() {
  return (
    <div className="page narrow">
      <h1 className="page-title">Ingresar</h1>
      <Suspense fallback={<div className="card form-card" aria-hidden="true" style={{ minHeight: 320 }} />}>
        <LoginForm />
      </Suspense>
      <p className="form-footnote">
        ¿Primera vez?{' '}
        <Suspense fallback={<a href="/registro">Creá tu cuenta</a>}>
          <AuthSwitchLink href="/registro">Creá tu cuenta</AuthSwitchLink>
        </Suspense>
      </p>
    </div>
  )
}
