'use client'

import { toast } from '@/components/Toast'

type Props = {
  action: (formData: FormData) => Promise<void>
  /** Texto del aviso cuando la acción termina bien. */
  success: string
  error?: string
  className?: string
  children: React.ReactNode
}

// Los redirect()/notFound() de Next viajan como errores con este prefijo: hay que dejarlos pasar.
function isNextControlFlow(err: unknown) {
  return typeof err === 'object' && err !== null && 'digest' in err && String(err.digest).startsWith('NEXT_')
}

/** Formulario de una Server Action del panel que confirma con un aviso "✓ Listo". */
export function ActionForm({ action, success, error = 'No se pudo guardar. Probá de nuevo.', className, children }: Props) {
  return (
    <form
      className={className}
      action={async (formData) => {
        try {
          await action(formData)
          toast(success)
        } catch (err) {
          if (isNextControlFlow(err)) throw err
          toast(error, 'error')
        }
      }}
    >
      {children}
    </form>
  )
}
