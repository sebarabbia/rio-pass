import Link from 'next/link'

export function PageLoading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="page">
      <p className="muted" role="status">{label}</p>
    </div>
  )
}

export function NoAccess({ role = 'organizadores' }: { role?: string }) {
  return (
    <div className="page center">
      <p className="kicker">Acceso restringido</p>
      <h1 className="page-title">Esta sección es para {role}</h1>
      <p className="muted">Si creés que deberías tener acceso, pedile a un organizador de Rio que te asigne el rol.</p>
      <Link href="/cuenta" className="btn btn-secondary">Ir a mi cuenta</Link>
    </div>
  )
}
