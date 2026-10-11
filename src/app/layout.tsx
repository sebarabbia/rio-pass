import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import './globals.css'

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Rio Pass', template: '%s · Rio Pass' },
  description: 'Las fechas de Rio, tu cuenta, tus entradas y tu tarjeta. Temporada de verano en Paraná.',
  applicationName: 'Rio Pass',
}

export const viewport: Viewport = {
  themeColor: '#2b3a3f',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={serif.variable}>
      <body>
        <SiteHeader />
        <main className="main">{children}</main>
        <footer className="footer">
          <p>Rio · Paraná, Entre Ríos</p>
          <p>
            <Link href="/">Eventos</Link> · <Link href="/cuenta">Mi cuenta</Link>
          </p>
        </footer>
      </body>
    </html>
  )
}
