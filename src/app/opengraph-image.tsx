import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/og'

export const alt = 'Rio Pass: las noches de Rio en un solo lugar'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image() {
  return renderOgCard({
    kicker: 'Temporada de verano · Paraná',
    title: 'Las noches de Rio, en un solo lugar.',
    lines: ['Próximas fechas, invitaciones y ranking.'],
  })
}
