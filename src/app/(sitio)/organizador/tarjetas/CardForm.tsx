'use client'

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { nfcErrorMessage, nfcSupported, normalizeUid, startNfcScan } from '@/lib/nfc'
import { createCard, type CardFormState } from './actions'

type Person = { id: string; name: string }
const noopSubscribe = () => () => {}

export function CardForm({ people }: { people: Person[] }) {
  const [state, formAction] = useActionState<CardFormState, FormData>(createCard, {})
  const canNfc = useSyncExternalStore(noopSubscribe, nfcSupported, () => false)
  const [scanning, setScanning] = useState(false)
  const [nfcMsg, setNfcMsg] = useState<string | null>(null)
  const uidRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Si se sale de la página con el lector prendido, se apaga.
  useEffect(() => () => abortRef.current?.abort(), [])

  async function readCard() {
    if (scanning) {
      abortRef.current?.abort()
      setScanning(false)
      setNfcMsg(null)
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setScanning(true)
    setNfcMsg('Apoyá la tarjeta en el dorso del celular…')
    try {
      await startNfcScan(
        (raw) => {
          const uid = normalizeUid(raw)
          ctrl.abort()
          setScanning(false)
          if (!uid) return setNfcMsg('La tarjeta no informó un número legible. Probá con otra.')
          if (uidRef.current) uidRef.current.value = uid
          navigator.vibrate?.(80)
          setNfcMsg(`✓ Tarjeta leída: ${uid}`)
        },
        () => setNfcMsg('No se pudo leer. Apoyala de nuevo y dejala quieta un segundo.'),
        ctrl.signal,
      )
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setScanning(false)
        setNfcMsg(nfcErrorMessage(err))
      }
    }
  }

  return (
    <form action={formAction} className="card form-card" noValidate>
      <p className="card-title">Cargar tarjeta</p>
      <div className="field">
        <label htmlFor="card-uid">Número de la tarjeta</label>
        {canNfc && (
          <button type="button" onClick={readCard} className={`btn btn-secondary btn-block${scanning ? ' is-waiting' : ''}`}>
            {scanning ? 'Esperando tarjeta… (tocá para cancelar)' : 'Leer con NFC'}
          </button>
        )}
        {nfcMsg && <p className="hint" aria-live="polite">{nfcMsg}</p>}
        <input
          ref={uidRef}
          id="card-uid"
          name="uid"
          className="input mono"
          placeholder="04:91:58:0A:8C:19:90"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
        />
        <p className="hint">
          {canNfc ? 'Apoyala o escribí el número a mano.' : 'Escribí el número de serie (en Android con Chrome también se puede leer apoyándola).'}
        </p>
      </div>
      <div className="field">
        <label htmlFor="card-label">
          Etiqueta <span className="optional">(opcional, p. ej. el número impreso)</span>
        </label>
        <input id="card-label" name="label" className="input" maxLength={40} placeholder="N° 001" />
      </div>
      <div className="field">
        <label htmlFor="card-user">Asignar a</label>
        <select id="card-user" name="userId" className="input" defaultValue="">
          <option value="">Sin asignar por ahora</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="hint">Aparecen los usuarios con rol RRPP. Asignalo en Usuarios si no está.</p>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.message && <p className="form-ok" role="status">{state.message}</p>}
      <SubmitButton pendingText="Guardando…">Guardar tarjeta</SubmitButton>
    </form>
  )
}
