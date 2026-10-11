export function PageLoading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="page">
      <p className="muted" role="status">{label}</p>
    </div>
  )
}
