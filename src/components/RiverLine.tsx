/** El río: una línea ondulada que se desliza despacio. Recurso gráfico de la marca (decorativo). */
export function RiverLine({ className }: { className?: string }) {
  // Dos períodos de la misma onda: al correrla medio ancho, el loop no se nota.
  const wave = 'M0 12 C 50 2, 100 2, 150 12 S 250 22, 300 12 S 400 2, 450 12 S 550 22, 600 12 S 700 2, 750 12 S 850 22, 900 12 S 1000 2, 1050 12 S 1150 22, 1200 12'
  return (
    <svg className={`river ${className ?? ''}`} viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="river-path" d={wave} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
