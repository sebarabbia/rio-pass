import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Ingresar' }

export default function LoginPage() {
  return (
    <div className="page narrow">
      <p className="kicker">Rio Pass</p>
      <h1 className="page-title">Ingresar</h1>
      <Suspense fallback={<div className="card form-card" aria-hidden="true" style={{ minHeight: 320 }} />}>
        <LoginForm />
      </Suspense>
      <p className="form-footnote">
        ¿Primera vez? <Link href="/registro">Creá tu cuenta</Link>
      </p>
    </div>
  )
}
