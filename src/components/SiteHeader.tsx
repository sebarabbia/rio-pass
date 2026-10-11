import Link from 'next/link'
import { Suspense } from 'react'
import { HeaderLoginButton } from '@/components/HeaderLoginButton'
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
  if (!user) return <HeaderLoginButton />
  // Un solo acceso de staff (el del rol principal) para que entre en el celular;
  // los demás están en "Mi cuenta". Un cliente no ve ninguno.
  const staffLink = hasRole(user, 'organizador')
    ? { href: '/organizador', label: 'Panel' }
    : hasRole(user, 'acreditador')
      ? { href: '/puerta', label: 'Puerta' }
      : hasRole(user, 'rrpp')
        ? { href: '/rrpp', label: 'RRPP' }
        : null
  return (
    <>
      {staffLink && (
        <Link href={staffLink.href} className="nav-link">{staffLink.label}</Link>
      )}
      <Link href="/cuenta" className="btn btn-secondary btn-sm">
        Mi cuenta
      </Link>
    </>
  )
}
