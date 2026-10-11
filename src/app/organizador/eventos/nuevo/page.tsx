import type { Metadata } from 'next'
import { Suspense } from 'react'
import { NoAccess, PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { EventForm } from '../../EventForm'

export const metadata: Metadata = { title: 'Nuevo evento' }

export default function NewEventPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewEvent />
    </Suspense>
  )
}

async function NewEvent() {
  const user = await requireUser('/organizador/eventos/nuevo')
  if (!hasRole(user, 'organizador')) return <NoAccess />

  const supabase = await createClient()
  const { data: seasons } = await supabase.from('seasons').select('id, name, is_current').order('starts_on', { ascending: false })

  return (
    <div className="page">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Nuevo evento</h1>
      <EventForm seasons={seasons ?? []} />
    </div>
  )
}
