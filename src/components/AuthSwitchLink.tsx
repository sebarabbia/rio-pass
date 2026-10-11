'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

/** Link entre "Ingresar" y "Crear cuenta" que conserva a dónde volver (?next=). */
export function AuthSwitchLink({ href, children }: { href: '/ingresar' | '/registro'; children: React.ReactNode }) {
  const next = useSearchParams().get('next')
  return <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href}>{children}</Link>
}
