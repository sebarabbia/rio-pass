import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Logo } from '@/components/Logo'
import { firstName } from '@/lib/format'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { upcomingSince } from '@/lib/events'
import { createClient } from '@/lib/supabase/server'
import { DoorApp } from './DoorApp'

export const metadata: Metadata = {
  title: 'Puerta',
  robots: { index: false, follow: false },
  // Instalable aparte: desde el celular de la puerta abre directo en /puerta.
  manifest: '/puerta.webmanifest',
  appleWebApp: { capable: true, title: 'Rio Puerta', statusBarStyle: 'black-translucent' },
}

export default function DoorPage() {
  return (
    <Suspense
      fallback={
        <div className="door-loading">
          <Logo className="door-loading-logo" />
        </div>
      }
    >
      <Door />
    </Suspense>
  )
}

async function Door() {
  const user = await getCurrentUser()
  // El proxy ya manda al login a quien no tiene sesión; sin el rol, la página "no existe".
  if (!user || !(hasRole(user, 'acreditador') || hasRole(user, 'organizador'))) notFound()

  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('id, name, starts_at, ends_at, venue')
    .eq('status', 'publicado')
    .gte('starts_at', upcomingSince())
    .order('starts_at', { ascending: true })
    .limit(12)

  return <DoorApp events={events ?? []} staffName={firstName(user.fullName)} isOrganizer={hasRole(user, 'organizador')} />
}
