import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { NoAccess, PageLoading } from '@/components/PageStates'
import { hasRole, requireUser } from '@/lib/auth'
import { flyerUrl } from '@/lib/events'
import { toLocalInputs } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { EventForm } from '../../EventForm'

export const metadata: Metadata = { title: 'Editar evento' }

export default function EditEventPage({ params }: PageProps<'/organizador/eventos/[id]'>) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditEvent params={params} />
    </Suspense>
  )
}

async function EditEvent({ params }: { params: PageProps<'/organizador/eventos/[id]'>['params'] }) {
  const { id } = await params
  const user = await requireUser(`/organizador/eventos/${id}`)
  if (!hasRole(user, 'organizador')) return <NoAccess />

  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('id, name, description, starts_at, ends_at, status, flyer_path')
    .eq('id', id)
    .maybeSingle()
  if (!event) notFound()

  const start = toLocalInputs(event.starts_at)
  return (
    <div className="page">
      <p className="kicker">Panel de organizador</p>
      <h1 className="page-title">Editar evento</h1>
      <EventForm
        initial={{
          id: event.id,
          name: event.name,
          date: start.date,
          startTime: start.time,
          endTime: event.ends_at ? toLocalInputs(event.ends_at).time : '',
          description: event.description,
          status: event.status,
          flyerUrl: flyerUrl(event.flyer_path),
        }}
      />
    </div>
  )
}
