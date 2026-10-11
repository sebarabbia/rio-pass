'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { normalizeUid } from '@/lib/nfc'
import { requireOrganizer } from '@/lib/organizer'

export type CardFormState = { error?: string; message?: string }

const UUID_RE = /^[0-9a-f-]{36}$/

export async function createCard(_prev: CardFormState, formData: FormData): Promise<CardFormState> {
  const supabase = await requireOrganizer()
  const me = await getCurrentUser()

  const uid = normalizeUid(String(formData.get('uid') ?? ''))
  const label = String(formData.get('label') ?? '').trim().slice(0, 40) || null
  const userId = String(formData.get('userId') ?? '')

  if (!uid) return { error: 'Número de tarjeta inválido. Apoyala con NFC o escribilo en hexadecimal (ej. 04:91:58:0A:8C:19:90).' }
  if (userId && !UUID_RE.test(userId)) return { error: 'Usuario inválido.' }

  const now = new Date().toISOString()
  const { error } = await supabase.from('nfc_cards').insert({
    uid,
    label,
    card_type: 'generica', // validada por número de serie; las NTAG 424 DNA llegan en la etapa 5
    user_id: userId || null,
    assigned_at: userId ? now : null,
    assigned_by: userId ? (me?.id ?? null) : null,
  })
  if (error) return { error: error.code === '23505' ? 'Esa tarjeta ya está cargada.' : 'No se pudo guardar la tarjeta.' }

  revalidatePath('/organizador/tarjetas')
  return { message: `Tarjeta ${uid} cargada.` }
}

export async function assignCard(formData: FormData) {
  const supabase = await requireOrganizer()
  const me = await getCurrentUser()
  const cardId = String(formData.get('cardId') ?? '')
  const userId = String(formData.get('userId') ?? '')
  if (!UUID_RE.test(cardId) || (userId && !UUID_RE.test(userId))) return

  await supabase
    .from('nfc_cards')
    .update({ user_id: userId || null, assigned_at: userId ? new Date().toISOString() : null, assigned_by: userId ? (me?.id ?? null) : null })
    .eq('id', cardId)
  revalidatePath('/organizador/tarjetas')
}

export async function setCardStatus(formData: FormData) {
  const supabase = await requireOrganizer()
  const cardId = String(formData.get('cardId') ?? '')
  const status = formData.get('status') === 'bloqueada' ? 'bloqueada' : 'activa'
  if (!UUID_RE.test(cardId)) return

  await supabase
    .from('nfc_cards')
    .update({ status, blocked_at: status === 'bloqueada' ? new Date().toISOString() : null })
    .eq('id', cardId)
  revalidatePath('/organizador/tarjetas')
}

export async function deleteCard(formData: FormData) {
  const supabase = await requireOrganizer()
  const cardId = String(formData.get('cardId') ?? '')
  if (!UUID_RE.test(cardId)) return
  await supabase.from('nfc_cards').delete().eq('id', cardId)
  revalidatePath('/organizador/tarjetas')
}
