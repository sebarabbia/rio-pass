import Link from 'next/link'

const ITEMS = [
  { key: 'eventos', href: '/organizador', label: 'Eventos' },
  { key: 'rrpp', href: '/organizador/rrpp', label: 'RRPP' },
  { key: 'usuarios', href: '/organizador/usuarios', label: 'Usuarios' },
  { key: 'tarjetas', href: '/organizador/tarjetas', label: 'Tarjetas' },
  { key: 'puntos', href: '/organizador/puntos', label: 'Puntos' },
  { key: 'temporadas', href: '/organizador/temporadas', label: 'Temporadas' },
  { key: 'puerta', href: '/puerta', label: 'Puerta ↗' },
] as const

export function OrganizerNav({ current }: { current: (typeof ITEMS)[number]['key'] }) {
  return (
    <nav className="subnav" aria-label="Panel de organizador">
      {ITEMS.map((item) => (
        <Link key={item.key} href={item.href} className="subnav-link" aria-current={item.key === current ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
