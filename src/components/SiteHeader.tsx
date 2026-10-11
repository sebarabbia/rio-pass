import Link from 'next/link'
import { Suspense } from 'react'
import { Logo } from '@/components/Logo'
import { getCurrentUser, hasRole } from '@/lib/auth'

export function SiteHeader() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" aria-label="Rio Pass, inicio">
          <Logo className="brand-logo" />
          <span className="brand-sep" aria-hidden="true" />
          <span className="brand-pass" aria-hidden="true">PASS</span>
        </Link>
        <nav className="nav" aria-label="Principal">
          <Link href="/#eventos" className="nav-link">Eventos</Link>
          {/* La parte que depende de la sesión se resuelve aparte para no frenar la página. */}
          <Suspense fallback={<span className="nav-placeholder" aria-hidden="true" />}>
            <HeaderAuth />
          </Suspense>
        </nav>
      </div>
    </header>
  )
}

async function HeaderAuth() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <Link href="/ingresar" className="btn btn-primary btn-sm">
        Ingresar
      </Link>
    )
  }
  return (
    <>
      {hasRole(user, 'organizador') && (
        <Link href="/organizador" className="nav-link">Panel</Link>
      )}
      <Link href="/cuenta" className="btn btn-secondary btn-sm">
        Mi cuenta
      </Link>
    </>
  )
}
