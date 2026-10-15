/** Cinta de texto que corre (como la marquesina de un boliche). Decorativa: la info real está en la página. */
export function Marquee({ items }: { items: string[] }) {
  if (items.length === 0) return null
  // Se repite para llenar pantallas anchas y loopear sin salto.
  const run = Array.from({ length: Math.max(2, Math.ceil(8 / items.length)) }, () => items).flat()
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <span key={copy} className="marquee-group">
            {run.map((item, i) => (
              <span key={i} className="marquee-item">
                {item}
                <span className="marquee-sep">✦</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}
