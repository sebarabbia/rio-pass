import type { Metadata } from 'next'
import Link from 'next/link'
import { RecoverForm } from './RecoverForm'

export const metadata: Metadata = { title: 'Recuperar contraseña' }

export default function RecoverPage() {
  return (
    <div className="page narrow">
      <h1 className="page-title">¿Olvidaste tu contraseña?</h1>
      <p className="muted page-lead">Escribí tu email y te mandamos un link para elegir una nueva. Tus entradas y tus puntos siguen ahí.</p>
      <RecoverForm />
      <p className="form-footnote">
        ¿Te acordaste? <Link href="/ingresar">Ingresá</Link>
      </p>
    </div>
  )
}
