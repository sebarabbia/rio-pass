import { formatLongDay, formatTime } from '@/lib/format'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/og'
import { createPublicClient } from '@/lib/supabase/public'

export const alt = 'Tu QR para entrar a Rio'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

// Vista previa del link que el RRPP manda por WhatsApp: el invitado ve el flyer y su nombre.
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { data } = /^[A-Za-z0-9_-]{16,64}$/.test(code)
    ? await createPublicClient().rpc('get_ticket_by_code', { _code: code })
    : { data: null }
  const ticket = data?.[0]
  if (!ticket) return renderOgCard({ kicker: 'Rio Pass', title: 'Las noches de Rio' })
  return renderOgCard({
    kicker: ticket.kind === 'invitacion' ? 'Invitación sin cargo' : 'Entrada',
    title: ticket.event_name,
    lines: [
      ...(ticket.holder_name ? [`Para ${ticket.holder_name}`] : []),
      `${formatLongDay(ticket.event_starts_at).replace(/ de \d{4}$/, '')} · ${formatTime(ticket.event_starts_at)} h`,
    ],
    flyerPath: ticket.event_flyer_path,
  })
}
