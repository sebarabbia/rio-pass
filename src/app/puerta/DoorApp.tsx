'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Logo } from '@/components/Logo'
import { formatShortDay, formatTime } from '@/lib/format'
import { nfcErrorMessage, nfcSupported, startNfcScan } from '@/lib/nfc'
import { createClient } from '@/lib/supabase/client'
import { GuestSearch } from './GuestSearch'

type DoorEvent = { id: string; name: string; starts_at: string; ends_at: string | null; venue: string }
type ScanMethod = 'qr' | 'nfc' | 'manual'
type DoorResult = {
  result: 'permitido' | 'rechazado'
  reason: string | null
  kind: 'invitacion' | 'entrada' | 'tarjeta' | 'rrpp' | null
  holder: string | null
  sector: string | null
  previous_at: string | null
  other_event: string | null
  count: number
  points: number | null
  rrpp: boolean | null
}
// rrpp: ingreso válido de un RRPP (la pantalla se pone azul en vez de verde).
type Shown = { key: number; ok: boolean; rrpp?: boolean; title: string; name: string | null; detail: string | null; points?: number | null }
type LogEntry = Shown & { at: number; method: ScanMethod }

type DetectedBarcode = { rawValue: string }
type BarcodeDetectorCtor = {
  new (options: { formats: string[] }): { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
  getSupportedFormats?: () => Promise<string[]>
}

const RESULT_MS = 2600 // cuánto queda el resultado en pantalla
const DEDUPE_MS = 4000 // la misma lectura repetida en este lapso se ignora
const EVENT_KEY = 'rioPass.puerta.evento'
const KIND_LABEL = { invitacion: 'Invitación', entrada: 'Entrada', tarjeta: 'Tarjeta', rrpp: 'QR de RRPP' } as const

// ---------- Textos del resultado ----------
function describe(r: DoorResult, key: number): Shown {
  const kind = r.kind ? KIND_LABEL[r.kind] : null
  const at = r.previous_at ? formatTime(r.previous_at) : null
  if (r.result === 'permitido') {
    const rrpp = !!r.rrpp
    return {
      key,
      ok: true,
      rrpp,
      title: rrpp ? 'Acceso RRPP' : 'Acceso permitido',
      name: r.holder,
      detail: [kind, r.sector].filter(Boolean).join(' · ') || null,
      points: r.points,
    }
  }
  const bad = (title: string, detail: string | null = null, name: string | null = r.holder): Shown => ({ key, ok: false, title, name, detail })
  switch (r.reason) {
    case 'ya_usado':
      return bad('Ya usado', at ? `Este QR ya entró a las ${at} h` : 'Este QR ya se usó')
    case 'otro_evento':
      return bad('Otra fecha', r.other_event ? `Es para: ${r.other_event}` : 'Es para otro evento')
    case 'anulado':
      return bad('QR anulado', 'Fue anulado y no permite el ingreso')
    case 'no_registrado':
      return bad('QR no válido', 'No es un QR de Rio Pass', null)
    case 'ya_ingreso':
      return bad('Ya ingresó', at ? `Esta tarjeta entró a las ${at} h` : 'Esta tarjeta ya entró esta noche')
    case 'bloqueada':
      return bad('Tarjeta bloqueada')
    case 'sin_asignar':
      return bad('Tarjeta sin asignar', 'No está asignada a nadie', null)
    case 'no_registrada':
      return bad('Tarjeta no reconocida', 'No está cargada en el sistema', null)
    default:
      return bad('No se pudo leer', 'Probá de nuevo', null)
  }
}

function cameraErrorMessage(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError') return 'Permiso de cámara denegado. Habilitalo en los permisos del sitio y volvé a intentar.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró una cámara en este dispositivo.'
  if (name === 'NotReadableError') return 'La cámara está ocupada por otra app. Cerrala y probá de nuevo.'
  return 'No se pudo abrir la cámara.'
}

const noopSubscribe = () => () => {}

// Reloj de minutos (para avisar si la fecha elegida no es la de hoy) sin Date.now() en el render.
const subscribeMinute = (cb: () => void) => {
  const id = window.setInterval(cb, 30_000)
  return () => window.clearInterval(id)
}
const getMinute = () => Math.floor(Date.now() / 60_000)
const getServerMinute = () => 0

const HOUR = 60 * 60 * 1000
/** La fecha "es esta noche" desde 6 h antes de abrir hasta 2 h después del cierre (o 12 h si no tiene cierre). */
function isTonight(event: DoorEvent, now: number) {
  const start = new Date(event.starts_at).getTime()
  const end = event.ends_at ? new Date(event.ends_at).getTime() : start + 12 * HOUR
  return now >= start - 6 * HOUR && now <= end + 2 * HOUR
}
function readSavedEvent() {
  try {
    return localStorage.getItem(EVENT_KEY)
  } catch {
    return null // sin almacenamiento: se usa la primera fecha
  }
}

export function DoorApp({ events, staffName, isOrganizer }: { events: DoorEvent[]; staffName: string; isOrganizer: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const canNfc = useSyncExternalStore(noopSubscribe, nfcSupported, () => false)

  // Fecha: la elegida ahora, si no la última elegida en este celular, si no la más próxima.
  const saved = useSyncExternalStore(noopSubscribe, readSavedEvent, () => null)
  const [chosen, setChosen] = useState<string | null>(null)
  const eventId = chosen ?? (saved && events.some((e) => e.id === saved) ? saved : (events[0]?.id ?? ''))
  const [count, setCount] = useState<number | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [nfcOn, setNfcOn] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState<Shown | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<number | undefined>(undefined)
  const nfcAbortRef = useRef<AbortController | null>(null)
  const pausedRef = useRef(false)
  const lastRef = useRef<{ value: string; at: number } | null>(null)
  const hideTimerRef = useRef<number | undefined>(undefined)
  const keyRef = useRef(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const audioRef = useRef<AudioContext | null>(null)

  const event = events.find((e) => e.id === eventId) ?? null
  const minute = useSyncExternalStore(subscribeMinute, getMinute, getServerMinute)
  const wrongNight = !!event && minute > 0 && !isTonight(event, minute * 60_000)

  // Contador de ingresos de la fecha elegida.
  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    supabase.rpc('door_stats', { _event_id: eventId }).then(({ data }) => {
      if (!cancelled && data && typeof data === 'object' && 'permitidos' in data) setCount(Number(data.permitidos))
    })
    return () => {
      cancelled = true
    }
  }, [eventId, supabase])

  // ---------- Feedback: vibración, sonido, pantalla encendida ----------
  const unlockAudio = useCallback(() => {
    try {
      audioRef.current = audioRef.current ?? new AudioContext()
      if (audioRef.current.state === 'suspended') void audioRef.current.resume()
    } catch {
      /* sin sonido */
    }
  }, [])

  const feedback = useCallback((ok: boolean) => {
    try {
      navigator.vibrate?.(ok ? 150 : [250, 100, 250])
    } catch {
      /* opcional */
    }
    const ctx = audioRef.current
    if (!ctx) return
    try {
      const t0 = ctx.currentTime
      const tones: [number, number, number][] = ok ? [[988, 0, 0.11], [1319, 0.12, 0.22]] : [[196, 0, 0.2], [196, 0.26, 0.34]]
      for (const [freq, start, dur] of tones) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = ok ? 'sine' : 'square'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, t0 + start)
        gain.gain.exponentialRampToValueAtTime(ok ? 0.35 : 0.16, t0 + start + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t0 + start)
        osc.stop(t0 + start + dur + 0.02)
      }
    } catch {
      /* sin sonido */
    }
  }, [])

  const keepAwake = useCallback(async (on: boolean) => {
    try {
      if (on && !wakeLockRef.current && 'wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null
        })
      } else if (!on && wakeLockRef.current) {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    } catch {
      /* si falla, la pantalla se apaga sola como siempre */
    }
  }, [])

  // ---------- Resultado ----------
  const hide = useCallback(() => {
    window.clearTimeout(hideTimerRef.current)
    setShown(null)
    pausedRef.current = false
  }, [])

  const show = useCallback(
    (s: Shown, method: ScanMethod) => {
      setShown(s)
      setLog((prev) => [{ ...s, at: Date.now(), method }, ...prev].slice(0, 15))
      feedback(s.ok)
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = window.setTimeout(hide, RESULT_MS)
    },
    [feedback, hide],
  )

  // ---------- Validación (la decide la base de datos, de forma atómica) ----------
  const validate = useCallback(
    async (method: ScanMethod, raw: string) => {
      const value = raw.trim()
      if (!eventId || !value || pausedRef.current) return
      const now = Date.now()
      if (method !== 'manual' && lastRef.current?.value === value && now - lastRef.current.at < DEDUPE_MS) return
      lastRef.current = { value, at: now }
      pausedRef.current = true
      setBusy(true)
      const { data, error } = await supabase.rpc('validate_access', { _event_id: eventId, _method: method, _value: value })
      setBusy(false)
      keyRef.current += 1
      if (error || !data) {
        lastRef.current = null // que se pueda reintentar
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        show(
          {
            key: keyRef.current,
            ok: false,
            title: offline ? 'Sin conexión' : 'Error',
            name: null,
            detail: offline ? 'Revisá el wifi o los datos y volvé a escanear' : 'No se pudo validar. Probá de nuevo',
          },
          method,
        )
        return
      }
      const result = data as unknown as DoorResult
      setCount(result.count)
      show(describe(result, keyRef.current), method)
    },
    [eventId, supabase, show],
  )

  // Los lectores (cámara y NFC) llaman siempre a la última versión de validate.
  const validateRef = useRef(validate)
  useEffect(() => {
    validateRef.current = validate
  }, [validate])

  // ---------- Cámara (QR) ----------
  const stopCamera = useCallback(() => {
    window.clearTimeout(loopRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }, [])

  async function startCamera() {
    unlockAudio()
    setNotice(null)
    const video = videoRef.current
    if (!video) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      video.srcObject = stream
      await video.play()

      // Lector nativo (Chrome/Android) o, si no hay, jsQR (iPhone y otros).
      let detect: (v: HTMLVideoElement) => Promise<string | null>
      const Native = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      const formats = Native ? await Native.getSupportedFormats?.().catch(() => []) : []
      if (Native && formats?.includes('qr_code')) {
        const detector = new Native({ formats: ['qr_code'] })
        detect = async (v) => (await detector.detect(v))[0]?.rawValue ?? null
      } else {
        const jsQR = (await import('jsqr')).default
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        detect = async (v) => {
          if (!ctx || !v.videoWidth) return null
          const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight))
          canvas.width = Math.round(v.videoWidth * scale)
          canvas.height = Math.round(v.videoHeight * scale)
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
        }
      }

      setCameraOn(true)
      void keepAwake(true)
      const tick = async () => {
        if (!streamRef.current) return
        if (!pausedRef.current && video.readyState >= 2) {
          try {
            const value = await detect(video)
            if (value) await validateRef.current('qr', value)
          } catch {
            /* frame ilegible: se sigue */
          }
        }
        loopRef.current = window.setTimeout(tick, 160)
      }
      void tick()
    } catch (err) {
      stopCamera()
      setNotice(cameraErrorMessage(err))
    }
  }

  // ---------- NFC (tarjetas) ----------
  async function toggleNfc() {
    if (nfcOn) {
      nfcAbortRef.current?.abort()
      setNfcOn(false)
      return
    }
    unlockAudio()
    setNotice(null)
    const ctrl = new AbortController()
    nfcAbortRef.current = ctrl
    try {
      await startNfcScan(
        (uid) => void validateRef.current('nfc', uid),
        () => setNotice('No se pudo leer la tarjeta. Apoyala de nuevo y dejala quieta un segundo.'),
        ctrl.signal,
      )
      setNfcOn(true)
      void keepAwake(true)
    } catch (err) {
      if (!ctrl.signal.aborted) setNotice(nfcErrorMessage(err))
    }
  }

  // Apagar todo al salir de la pantalla.
  useEffect(() => {
    return () => {
      stopCamera()
      nfcAbortRef.current?.abort()
      void keepAwake(false)
      window.clearTimeout(hideTimerRef.current)
    }
  }, [stopCamera, keepAwake])

  function onEventChange(id: string) {
    setChosen(id)
    setCount(null)
    setLog([])
    lastRef.current = null
    try {
      localStorage.setItem(EVENT_KEY, id)
    } catch {
      /* opcional */
    }
  }

  function onManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    unlockAudio()
    const input = e.currentTarget.elements.namedItem('code') as HTMLInputElement
    const value = input.value
    input.value = ''
    input.blur()
    void validate('manual', value)
  }

  if (events.length === 0) {
    return (
      <div className="door-app">
        <DoorTop staffName={staffName} isOrganizer={isOrganizer} />
        <div className="empty">
          <p className="empty-title">No hay fechas publicadas</p>
          <p>Cuando se publique la próxima, la vas a poder elegir acá.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="door-app">
      <DoorTop staffName={staffName} isOrganizer={isOrganizer} />

      <label className="door-event">
        <span className="label">Fecha</span>
        <select className="input" value={eventId} onChange={(e) => onEventChange(e.target.value)}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {formatShortDay(e.starts_at)} · {e.name}
            </option>
          ))}
        </select>
      </label>

      {wrongNight && event && (
        <p className="door-warning" role="alert">
          Ojo: elegiste {formatShortDay(event.starts_at)} · {event.name}, que no es la fecha de hoy. Si los QR dan “Otra fecha”, cambiala arriba.
        </p>
      )}

      <div className="door-count" aria-live="polite">
        <span className="door-count-value">{count ?? '–'}</span>
        <span className="door-count-label">ingresos{event ? ` · ${event.name}` : ''}</span>
      </div>

      <div className={`door-camera${cameraOn ? ' is-on' : ''}`}>
        <video ref={videoRef} playsInline muted aria-label="Cámara para escanear QR" />
        <span className="door-camera-frame" aria-hidden="true" />
        {busy && <span className="door-busy">Validando…</span>}
      </div>

      <div className="door-actions">
        <button type="button" className={`btn btn-xl${cameraOn ? ' is-stop' : ''}`} onClick={() => (cameraOn ? stopCamera() : startCamera())}>
          {cameraOn ? 'Cerrar cámara' : 'Escanear QR'}
        </button>
        {canNfc && (
          <button type="button" className={`btn btn-secondary btn-tall${nfcOn ? ' is-listening' : ''}`} onClick={toggleNfc}>
            {nfcOn ? 'Leyendo tarjetas · tocar para frenar' : 'Leer tarjetas NFC'}
          </button>
        )}
      </div>
      {nfcOn && <p className="door-hint">Apoyá la tarjeta en el dorso del celular. Queda escuchando: una tras otra.</p>}
      {notice && <p className="door-notice" role="status">{notice}</p>}

      <GuestSearch key={eventId} eventId={eventId} onAdmit={(code) => validate('manual', code)} />

      <details className="card door-manual">
        <summary>Ingresar código a mano</summary>
        <form onSubmit={onManual} className="door-manual-form">
          <input name="code" className="input mono" placeholder="Código del QR o número de tarjeta" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          <button type="submit" className="btn btn-primary">Validar</button>
        </form>
      </details>

      <section aria-labelledby="door-log-title">
        <h2 id="door-log-title" className="block-title">Últimas lecturas</h2>
        {log.length === 0 ? (
          <p className="muted small">Todavía no se validó nada desde este celular.</p>
        ) : (
          <ul className="list">
            {log.map((entry) => (
              <li key={entry.key} className={`door-log ${entry.ok ? (entry.rrpp ? 'is-rrpp' : 'is-ok') : 'is-bad'}`}>
                <span className="door-log-mark" aria-hidden="true">{entry.ok ? '✓' : '✕'}</span>
                <div className="door-log-body">
                  <p className="door-log-main">{entry.name ?? entry.title}</p>
                  <p className="muted small">
                    {entry.ok ? entry.detail ?? 'Permitido' : entry.name ? entry.title : entry.detail ?? entry.title}
                  </p>
                </div>
                <span className="door-log-time">{formatTime(new Date(entry.at).toISOString())}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {shown && (
        <div className={`door-result ${shown.ok ? (shown.rrpp ? 'is-rrpp' : 'is-ok') : 'is-bad'}`} role="alert" onClick={hide}>
          <Logo className="door-result-logo" />
          <div className="door-result-inner" key={shown.key}>
            <div className="door-result-icon" aria-hidden="true">
              {shown.ok ? (
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M11 25l8.5 8.5L37 15" /></svg>
              ) : (
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><path d="M15 15l18 18M33 15L15 33" /></svg>
              )}
            </div>
            <p className="door-result-title">{shown.title}</p>
            {shown.name && <p className="door-result-name">{shown.name}</p>}
            {shown.detail && <p className="door-result-detail">{shown.detail}</p>}
            {shown.points ? <p className="door-result-points">+{shown.points} puntos</p> : null}
          </div>
          <div className="door-result-progress">
            <span key={shown.key} style={{ animationDuration: `${RESULT_MS}ms` }} />
          </div>
          <p className="door-result-hint">Tocá para seguir</p>
        </div>
      )}
    </div>
  )
}

function DoorTop({ staffName, isOrganizer }: { staffName: string; isOrganizer: boolean }) {
  return (
    <header className="door-top">
      <div className="brand">
        <Logo className="brand-logo" />
        <span className="brand-sep" aria-hidden="true" />
        <span className="brand-pass">PUERTA</span>
      </div>
      <Link href={isOrganizer ? '/organizador' : '/cuenta'} className="nav-link">
        {staffName ? `${staffName} · Salir` : 'Salir'}
      </Link>
    </header>
  )
}
