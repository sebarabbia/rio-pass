import type { MetadataRoute } from 'next'

// Para "Agregar a pantalla de inicio": se abre como app, a pantalla completa.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rio Pass',
    short_name: 'Rio Pass',
    description: 'Las fechas de Rio, tus invitaciones y tus puntos.',
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#2b3a3f',
    theme_color: '#2b3a3f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
