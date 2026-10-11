'use client'

import Link from 'next/link'
import { useActionState, useState, useTransition, type FormEvent } from 'react'
import { DEFAULT_RRPP_QUOTA, DEFAULT_SECTORS, DEFAULT_VENUE } from '@/lib/event-defaults'
import { createClient } from '@/lib/supabase/client'
import { saveEvent, type EventFormState } from './actions'

const FLYER_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_FLYER_BYTES = 5 * 1024 * 1024

export type EventFormValues = {
  id: string
  name: string
  date: string
  startTime: string
  endTime: string
  description: string
  status: 'borrador' | 'publicado' | 'cancelado'
  flyerUrl: string | null
  venue: string
  sectors: string
  quota: number
  seasonId: string | null
}

type Season = { id: string; name: string; is_current: boolean }

export function EventForm({ initial, seasons }: { initial?: EventFormValues; seasons: Season[] }) {
  const [state, formAction] = useActionState<EventFormState, FormData>(saveEvent, {})
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(initial?.flyerUrl ?? null)
  const busy = uploading || isPending
  const defaultSeason = initial ? (initial.seasonId ?? '') : (seasons.find((s) => s.is_current)?.id ?? '')

  function onFlyerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setLocalError(null)
    if (!file) return setPreview(initial?.flyerUrl ?? null)
    if (!FLYER_TYPES[file.type]) {
      e.target.value = ''
      return setLocalError('El flyer tiene que ser JPG, PNG o WebP.')
    }
    if (file.size > MAX_FLYER_BYTES) {
      e.target.value = ''
      return setLocalError('El flyer pesa más de 5 MB. Exportalo más liviano.')
    }
    setPreview(URL.createObjectURL(file))
  }

  // El flyer se sube directo del navegador a Supabase Storage (las políticas RLS
  // verifican que seas organizador) y al servidor solo viaja su ruta. Así no
  // chocamos con el límite de tamaño de las Server Actions / Vercel.
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLocalError(null)
    const formData = new FormData(e.currentTarget)
    const file = formData.get('flyer')
    formData.delete('flyer')

    if (file instanceof File && file.size > 0) {
      setUploading(true)
      const path = `${crypto.randomUUID()}.${FLYER_TYPES[file.type]}`
      const { error } = await createClient()
        .storage.from('event-flyers')
        .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
      setUploading(false)
      if (error) return setLocalError('No se pudo subir el flyer. Revisá tu conexión y probá de nuevo.')
      formData.set('flyerPath', path)
    }

    startTransition(() => formAction(formData))
  }

  const error = localError ?? state.error

  return (
    <form onSubmit={onSubmit} className="card form-card" noValidate>
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="field">
        <label htmlFor="name">Nombre del evento</label>
        <input id="name" name="name" className="input" maxLength={120} defaultValue={initial?.name} placeholder="Apertura de temporada" required />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="date">Fecha</label>
          <input id="date" name="date" type="date" className="input" defaultValue={initial?.date} required />
        </div>
        <div className="field">
          <label htmlFor="startTime">Abre</label>
          <input id="startTime" name="startTime" type="time" className="input" defaultValue={initial?.startTime ?? '23:30'} required />
        </div>
        <div className="field">
          <label htmlFor="endTime">
            Cierra <span className="optional">(opc.)</span>
          </label>
          <input id="endTime" name="endTime" type="time" className="input" defaultValue={initial?.endTime ?? ''} />
        </div>
      </div>
      <p className="hint">Hora de Argentina. Si cierra después de medianoche, se toma como el día siguiente.</p>

      <div className="field">
        <label htmlFor="venue">Lugar</label>
        <input id="venue" name="venue" className="input" maxLength={120} defaultValue={initial?.venue ?? DEFAULT_VENUE} required />
      </div>

      <div className="field">
        <label htmlFor="description">
          Descripción <span className="optional">(opcional)</span>
        </label>
        <textarea id="description" name="description" className="input textarea" rows={5} maxLength={4000} defaultValue={initial?.description} placeholder="Line-up, dress code, info útil…" />
      </div>

      <div className="field">
        <label htmlFor="sectors">Sectores</label>
        <input id="sectors" name="sectors" className="input" maxLength={200} defaultValue={initial?.sectors ?? DEFAULT_SECTORS.join(', ')} />
        <p className="hint">Separados por coma. Se muestran en la web y se eligen al generar cada QR.</p>
      </div>

      <div className="field-row two">
        <div className="field">
          <label htmlFor="quota">QR sin cargo por RRPP</label>
          <input id="quota" name="quota" type="number" inputMode="numeric" min={0} max={1000} className="input" defaultValue={initial?.quota ?? DEFAULT_RRPP_QUOTA} required />
        </div>
        <div className="field">
          <label htmlFor="seasonId">Temporada</label>
          <select id="seasonId" name="seasonId" className="input" defaultValue={defaultSeason}>
            <option value="">Sin temporada</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_current ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="flyer">Flyer</label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local
          <img src={preview} alt="Vista previa del flyer" className="flyer-preview" />
        )}
        <input id="flyer" name="flyer" type="file" className="input file" accept="image/jpeg,image/png,image/webp" onChange={onFlyerChange} />
        <p className="hint">JPG, PNG o WebP, hasta 5 MB. Ideal vertical (4:5).</p>
        {initial?.flyerUrl && (
          <label className="check">
            <input type="checkbox" name="removeFlyer" /> Quitar el flyer actual
          </label>
        )}
      </div>

      <div className="field">
        <label htmlFor="status">Estado</label>
        <select id="status" name="status" className="input" defaultValue={initial?.status ?? 'borrador'}>
          <option value="borrador">Borrador (no se ve en la web)</option>
          <option value="publicado">Publicado (visible para todos)</option>
          <option value="cancelado">Cancelado (no se ve en la web)</option>
        </select>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <Link href="/organizador" className="btn btn-ghost">Cancelar</Link>
        <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
          {uploading ? 'Subiendo flyer…' : isPending ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear evento'}
        </button>
      </div>
    </form>
  )
}
