import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ActionForm } from '@/components/ActionForm'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { formatShortDay, formatTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { OrganizerNav } from '../OrganizerNav'
import { assignCard, deleteCard, setCardStatus } from './actions'
import { CardForm } from './CardForm'

export const metadata: Metadata = { title: 'Tarjetas NFC' }

export default function CardsPage() {
  return (
    <Suspense fallback={<PageLoading label="Cargando tarjetas…" />}>
      <Cards />
    </Suspense>
  )
}

async function Cards() {
  const user = await requireUser('/organizador/tarjetas')
  if (!hasRole(user, 'organizador')) notFound()

  const supabase = await createClient()
  const [{ data: cards }, { data: rrpps }] = await Promise.all([
    supabase
      .from('nfc_cards')
      .select('id, uid, label, status, user_id, last_tap_at, owner:profiles!nfc_cards_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false }),
    supabase.from('user_roles').select('profile:profiles!user_roles_user_id_fkey(id, full_name, email)').eq('role', 'rrpp'),
  ])

  const people = (rrpps ?? [])
    .map((r) => r.profile)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ id: p.id, name: p.full_name || p.email || 'Sin nombre' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <div className="page wide">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Tarjetas NFC</h1>
      <OrganizerNav current="tarjetas" />
      <p className="muted">
        Cada tarjeta se reconoce por su número de serie. Asignala a un RRPP y en la puerta va a entrar con solo apoyarla
        (una vez por noche). Si se pierde, bloqueala.
      </p>

      <CardForm people={people} />

      <section className="section-block" aria-labelledby="h-cards">
        <h2 id="h-cards" className="block-title">Tarjetas cargadas ({cards?.length ?? 0})</h2>
        {!cards?.length ? (
          <div className="empty">
            <p className="empty-title">Todavía no hay tarjetas</p>
            <p>Cargá la primera arriba.</p>
          </div>
        ) : (
          <ul className="list admin-grid">
            {cards.map((card) => {
              const active = card.status === 'activa'
              const ownerName = card.owner?.full_name || card.owner?.email
              return (
                <li key={card.id} className={`card nfc-card${active ? '' : ' is-void'}`}>
                  <div className="row">
                    <div className="invitation-info">
                      <p className="card-title">{ownerName ?? 'Sin asignar'}</p>
                      <p className="mono muted small">
                        {card.uid}
                        {card.label ? ` · ${card.label}` : ''}
                      </p>
                      {card.last_tap_at && (
                        <p className="muted small">Último uso: {formatShortDay(card.last_tap_at)} {formatTime(card.last_tap_at)} h</p>
                      )}
                    </div>
                    <span className={`pill ${active ? 'pill-ok' : 'pill-bad'}`}>{active ? 'Activa' : 'Bloqueada'}</span>
                  </div>
                  <ActionForm action={assignCard} className="assign-row" success="Asignación guardada">
                    <input type="hidden" name="cardId" value={card.id} />
                    <select name="userId" className="input" defaultValue={card.user_id ?? ''} aria-label="Asignar a">
                      <option value="">Sin asignar</option>
                      {card.user_id && !people.some((p) => p.id === card.user_id) && (
                        <option value={card.user_id}>{ownerName ?? 'Usuario actual'}</option>
                      )}
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button type="submit" className="btn btn-secondary btn-sm">Asignar</button>
                  </ActionForm>
                  <div className="invitation-actions">
                    <ActionForm action={setCardStatus} success={active ? 'Tarjeta bloqueada' : 'Tarjeta desbloqueada'}>
                      <input type="hidden" name="cardId" value={card.id} />
                      <input type="hidden" name="status" value={active ? 'bloqueada' : 'activa'} />
                      <button type="submit" className="btn btn-secondary btn-sm">{active ? 'Bloquear' : 'Desbloquear'}</button>
                    </ActionForm>
                    <ActionForm action={deleteCard} success="Tarjeta eliminada">
                      <input type="hidden" name="cardId" value={card.id} />
                      <ConfirmSubmit message={`¿Eliminar la tarjeta ${card.uid}?`} className="btn btn-danger btn-sm">
                        Eliminar
                      </ConfirmSubmit>
                    </ActionForm>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
