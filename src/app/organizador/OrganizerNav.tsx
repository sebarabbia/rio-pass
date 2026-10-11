import Link from 'next/link'

const ITEMS = [
  { key: 'eventos', href: '/organizador', label: 'Eventos' },
  { key: 'usuarios', href: '/organizador/usuarios', label: 'Usuarios' },
  { key: 'temporadas', href: '/organizador/temporadas', label: 'Temporadas' },
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
