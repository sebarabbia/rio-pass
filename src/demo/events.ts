import 'server-only'

// Fechas de ejemplo para mostrar la web con contenido real (flyers de la temporada
// pasada, puestos en los viernes equivalentes del verano 2027). Se cargan y se
// borran desde /organizador/demo. Los slugs identifican qué eventos son de ejemplo.

export const DEMO_SEASON = { name: 'Verano 2027', starts_on: '2026-12-01', ends_on: '2027-03-31' }

export const DEMO_EVENTS = [
  {
    slug: 'apertura-2027-01-22',
    name: 'Apertura',
    date: '2027-01-22',
    startTime: '23:30',
    endTime: '06:00',
    flyer: { file: 'apertura.webp', contentType: 'image/webp', ext: 'webp' },
    description:
      'Arranca el verano en Rio. La primera noche de la temporada, frente al río en Complejo Arenas.\n\nQRs sin cargo limitados con nuestros RRPP.',
  },
  {
    slug: 'rio-tropical-2027-02-05',
    name: 'Rio Tropical',
    date: '2027-02-05',
    startTime: '23:30',
    endTime: '06:00',
    flyer: { file: 'rio-tropical.jpg', contentType: 'image/jpeg', ext: 'jpg' },
    description:
      'Una noche tropical en las Playas del Thompson: color, flores y música para bailar hasta que salga el sol.\n\nQRs sin cargo limitados con nuestros RRPP.',
  },
  {
    slug: 'old-school-2027-02-19',
    name: 'Old School · Noche de reggaetón viejo',
    date: '2027-02-19',
    startTime: '23:30',
    endTime: '06:00',
    flyer: { file: 'old-school.jpg', contentType: 'image/jpeg', ext: 'jpg' },
    description:
      'Los clásicos que no pueden faltar: una noche entera de reggaetón viejo. Los viernes son en Rio.\n\nQRs sin cargo limitados con nuestros RRPP.',
  },
] as const

export const DEMO_SLUGS = DEMO_EVENTS.map((e) => e.slug)
