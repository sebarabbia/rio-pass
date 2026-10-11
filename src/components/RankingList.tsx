import { PRIZE_POSITIONS, type RankingRow } from '@/lib/ranking'

/** Lista del ranking. Marca el podio, la fila propia y dónde termina la zona de premio. */
export function RankingList({ rows, compact = false }: { rows: RankingRow[]; compact?: boolean }) {
  return (
    <ol className={`ranking${compact ? ' is-compact' : ''}`}>
      {rows.map((row) => (
        <li key={row.pos} className="ranking-item">
          <div className={`ranking-row${row.pos <= 3 ? ' is-podium' : ''}${row.is_me ? ' is-me' : ''}`}>
            <span className="ranking-pos">{row.pos}</span>
            <span className="ranking-name">
              {row.name}
              {row.is_me && <span className="ranking-you">Vos</span>}
            </span>
            <span className="ranking-points">
              {row.points}
              <small> pts</small>
            </span>
          </div>
          {!compact && row.pos === PRIZE_POSITIONS && rows.length > PRIZE_POSITIONS && (
            <p className="ranking-cut">Zona de premio ↑</p>
          )}
        </li>
      ))}
    </ol>
  )
}
