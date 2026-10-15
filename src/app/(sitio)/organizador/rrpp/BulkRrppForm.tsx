'use client'

import { useMemo, useState } from 'react'
import type { BulkResult, Person } from '@/lib/accounts'
import { bulkAddRrpp } from './actions'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s()-]{5,29}$/
const CHUNK = 40

const STATUS_LABEL: Record<BulkResult['status'], string> = {
  creado: 'Cuenta creada',
  actualizado: 'Tenía cuenta: ahora es RRPP',
  ya_era_rrpp: 'Ya era RRPP (se actualizó su organizador)',
  otro_perfil: 'Tiene otro perfil (no se cambió)',
  error: 'Error',
}

/**
 * Una persona por renglón, copiada de Excel o Google Sheets (columnas separadas
 * por tab, coma o punto y coma) en cualquier orden: nombre, email y celular.
 */
function parse(text: string): { people: Person[]; skipped: string[] } {
  const people: Person[] = []
  const skipped: string[] = []
  const seen = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(/[\t;,]/).map((c) => c.trim()).filter(Boolean)
    if (cells.length === 0) continue
    const email = cells.find((c) => EMAIL_RE.test(c))?.toLowerCase()
    if (!email) {
      skipped.push(line.trim())
      continue
    }
    if (seen.has(email)) continue
    seen.add(email)
    const phone = cells.find((c) => c !== email && PHONE_RE.test(c) && /\d{6,}/.test(c.replace(/\D/g, ''))) ?? null
    const fullName = cells.find((c) => c.toLowerCase() !== email && c !== phone) ?? ''
    people.push({ email, full_name: fullName, phone })
  }
  return { people, skipped }
}

export function BulkRrppForm({ organizers, me }: { organizers: { id: string; name: string }[]; me: string }) {
  const [text, setText] = useState('')
  const [managerId, setManagerId] = useState(me)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [results, setResults] = useState<BulkResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { people, skipped } = useMemo(() => parse(text), [text])
  const busy = progress !== null && progress.done < progress.total

  async function submit() {
    setError(null)
    setResults(null)
    const all: BulkResult[] = []
    setProgress({ done: 0, total: people.length })
    try {
      for (let i = 0; i < people.length; i += CHUNK) {
        all.push(...(await bulkAddRrpp(people.slice(i, i + CHUNK), managerId)))
        setProgress({ done: Math.min(i + CHUNK, people.length), total: people.length })
      }
      setResults(all)
      if (all.every((r) => r.status !== 'error')) setText('')
    } catch {
      setError('Se cortó la carga. Lo que ya se cargó quedó guardado: volvé a pegar la lista y se saltean los que ya están.')
      setResults(all)
    } finally {
      setProgress(null)
    }
  }

  const count = (status: BulkResult['status']) => results?.filter((r) => r.status === status).length ?? 0
  const problems = results?.filter((r) => r.status === 'error' || r.status === 'otro_perfil') ?? []

  return (
    <div className="card form-card">
      <p className="muted small">
        Pegá la lista copiada de Excel o Google Sheets: una persona por renglón con nombre, email y celular (en cualquier
        orden). Se les crea la cuenta y quedan a cargo del organizador que elijas. Para entrar, cada uno activa su cuenta en
        /activar con su email.
      </p>
      <div className="field">
        <label htmlFor="bulk-text">Lista</label>
        <textarea
          id="bulk-text"
          className="input textarea mono"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Sofía Martínez\tsofi@gmail.com\t343 456 7890\nJuan Pérez, juanp@gmail.com, 343 111 2222'}
          spellCheck={false}
        />
        <p className="hint" aria-live="polite">
          {people.length > 0 ? `${people.length} persona${people.length === 1 ? '' : 's'} para cargar` : 'Todavía no hay renglones con email.'}
          {skipped.length > 0 ? ` · ${skipped.length} renglón${skipped.length === 1 ? '' : 'es'} sin email se saltean` : ''}
        </p>
      </div>
      <div className="field">
        <label htmlFor="bulk-manager">Organizador responsable</label>
        <select id="bulk-manager" className="input" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          {organizers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.id === me ? ' (vos)' : ''}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={busy || people.length === 0} onClick={() => void submit()}>
        {busy && progress ? `Cargando ${progress.done} de ${progress.total}…` : people.length ? `Dar de alta ${people.length} RRPP` : 'Dar de alta RRPP'}
      </button>

      {results && results.length > 0 && (
        <div className="bulk-results" role="status">
          <p>
            <strong>Listo:</strong> {count('creado')} cuentas nuevas · {count('actualizado')} pasaron a RRPP · {count('ya_era_rrpp')} ya eran RRPP
            {problems.length > 0 ? ` · ${problems.length} con problemas` : ''}
          </p>
          {problems.length > 0 && (
            <ul className="list bulk-problems">
              {problems.map((r) => (
                <li key={r.email} className="muted small">
                  {r.email}: {STATUS_LABEL[r.status]}
                  {r.detail ? ` (${r.detail})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
