'use client'

import { useMemo, useState } from 'react'
import { formatTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type Guest = Database['public']['Functions']['search_door_guests']['Returns'][number]

/**
 * Buscar un invitado por nombre: para quien no puede mostrar el QR (sin batería,
 * sin señal). "Dar ingreso" valida su QR igual que si lo hubieran escaneado.
 */
export function GuestSearch({ eventId, onAdmit }: { eventId: string; onAdmit: (code: string) => Promise<void> }) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Guest[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    const term = query.trim()
    if (term.length < 2) {
      setResults(null)
      setError('Escribí al menos 2 letras del nombre.')
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('search_door_guests', { _event_id: eventId, _query: term })
    setLoading(false)
    if (rpcError) {
      setError('No se pudo buscar. Revisá la conexión y probá de nuevo.')
      return
    }
    setResults(data)
  }

  async function admit(guest: Guest) {
    const name = guest.holder ?? 'esta persona'
    if (!confirm(`¿Dar ingreso a ${name}? Pedile el DNI para confirmar que es la persona del QR.`)) return
    await onAdmit(guest.code)
    await search() // refresca el estado (pasa a "Entró")
  }

  return (
    <details className="card door-manual">
      <summary>Buscar por nombre</summary>
      <form
        className="door-manual-form"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <input
          type="search"
          className="input"
          placeholder="Nombre o apellido"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          aria-label="Nombre del invitado"
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {results &&
        (results.length === 0 ? (
          <p className="muted small">No hay QR con ese nombre para esta fecha.</p>
        ) : (
          <ul className="list guest-results">
            {results.map((g) => (
              <li key={g.code} className="guest-row">
                <div className="guest-info">
                  <p className="guest-name">{g.holder ?? 'Sin nombre'}</p>
                  <p className="muted small">{[g.sector, g.issuer ? `de ${g.issuer}` : null].filter(Boolean).join(' · ') || 'Invitación'}</p>
                </div>
                {g.status === 'valido' ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void admit(g)}>
                    Dar ingreso
                  </button>
                ) : (
                  <span className={`pill ${g.status === 'usado' ? 'pill-muted' : 'pill-bad'}`}>
                    {g.status === 'usado' ? `Entró ${g.used_at ? formatTime(g.used_at) : ''}`.trim() : 'Anulado'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ))}
    </details>
  )
}
