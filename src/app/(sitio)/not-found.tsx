import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="page center">
      <p className="kicker">Error 404</p>
      <h1 className="page-title">No encontramos esta página</h1>
      <p className="muted">Puede que el evento ya no esté publicado.</p>
      <Link href="/" className="btn btn-primary">Ver próximas fechas</Link>
    </div>
  )
}
