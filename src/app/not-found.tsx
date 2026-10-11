import Link from 'next/link'
import { Logo } from '@/components/Logo'

// 404 para direcciones que no existen (fuera del layout del sitio).
export default function NotFound() {
  return (
    <main className="main">
      <div className="page center">
        <Link href="/" aria-label="Rio Pass, inicio">
          <Logo className="hero-logo" />
        </Link>
        <h1 className="page-title">No encontramos esta página</h1>
        <Link href="/" className="btn btn-primary">Ver próximas fechas</Link>
      </div>
    </main>
  )
}
