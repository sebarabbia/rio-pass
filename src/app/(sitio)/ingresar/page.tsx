import type { Metadata } from 'next'
import Link from 'next/link'
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
      <p className="form-footnote small">
        ¿Te regalaron un QR o te dio de alta un organizador? <Link href="/activar">Activá tu cuenta</Link>
      </p>
    </div>
  )
}
