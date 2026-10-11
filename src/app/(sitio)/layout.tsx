import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="main">{children}</main>
      <footer className="footer">
        <p>Rio · Paraná, Entre Ríos</p>
        <p>
          <Link href="/">Eventos</Link> · <Link href="/ranking">Ranking</Link> · <Link href="/cuenta">Mi cuenta</Link>
        </p>
      </footer>
    </>
  )
}
