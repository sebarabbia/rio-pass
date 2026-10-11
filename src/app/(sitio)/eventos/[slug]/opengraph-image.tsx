import { getPublicEvent } from '@/lib/events'
import { formatLongDay, formatTime } from '@/lib/format'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/og'

export const alt = 'Flyer y datos de la fecha en Rio'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getPublicEvent(slug)
  if (!event) return renderOgCard({ kicker: 'Rio Pass', title: 'Las noches de Rio' })
  return renderOgCard({
    kicker: formatLongDay(event.starts_at).replace(/ de \d{4}$/, ''),
    title: event.name,
    lines: [`Desde las ${formatTime(event.starts_at)} h`, event.venue],
    flyerPath: event.flyer_path,
  })
}
