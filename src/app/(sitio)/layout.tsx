import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { RiverLine } from '@/components/RiverLine'
import { SiteHeader } from '@/components/SiteHeader'
import { Toaster } from '@/components/Toast'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="main">{children}</main>
      <footer className="footer2">
        <RiverLine className="footer2-river" />
        <div className="footer2-inner">
          <nav className="footer2-nav" aria-label="Pie de página">
            <Link href="/">Eventos</Link>
            <Link href="/ranking">Ranking</Link>
            <Link href="/cuenta">Mi cuenta</Link>
          </nav>
          <p className="footer2-place">Rio · Paraná, Entre Ríos</p>
        </div>
        <Logo className="footer2-wordmark" title="" />
      </footer>
      <Toaster />
    </>
  )
}
