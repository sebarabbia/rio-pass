import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import { siteUrl } from '@/lib/site'
import './globals.css'

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Rio Pass', template: '%s · Rio Pass' },
  description: 'Las fechas de Rio, tus invitaciones y tus puntos. Temporada de verano en Paraná.',
  applicationName: 'Rio Pass',
  // Base para las URLs absolutas de las imágenes de vista previa (opengraph-image).
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: 'Rio Pass', locale: 'es_AR', type: 'website' },
  twitter: { card: 'summary_large_image' },
  // Instalable en la pantalla de inicio (ver app/manifest.ts).
  appleWebApp: { capable: true, title: 'Rio Pass', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: '#2b3a3f',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

// Layout raíz: solo documento, fuentes y estilos. El sitio (con menú y pie) está en
// app/(sitio)/layout.tsx; la pantalla de la puerta (app/puerta) ocupa todo el celular.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={serif.variable}>
      <body>{children}</body>
    </html>
  )
}
