import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { PageLoading } from '@/components/PageStates'
import { requireUser } from '@/lib/auth'
import { PasswordForm } from './PasswordForm'

export const metadata: Metadata = { title: 'Cambiar contraseña' }

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ChangePassword />
    </Suspense>
  )
}

async function ChangePassword() {
  await requireUser('/cuenta/contrasena')
  return (
    <div className="page narrow">
      <Link href="/cuenta" className="back-link">← Mi cuenta</Link>
      <h1 className="page-title">Contraseña nueva</h1>
      <PasswordForm />
    </div>
  )
}
