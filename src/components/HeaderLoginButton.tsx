'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const AUTH_PAGES = ['/ingresar', '/registro', '/recuperar', '/activar']

/** "Ingresar" del header: no se muestra en las propias pantallas de ingreso. */
export function HeaderLoginButton() {
  const pathname = usePathname()
  if (AUTH_PAGES.includes(pathname)) return null
  return (
    <Link href="/ingresar" className="btn btn-primary btn-sm">
      Ingresar
    </Link>
  )
}
