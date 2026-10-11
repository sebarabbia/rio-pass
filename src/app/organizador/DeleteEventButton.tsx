'use client'

import { deleteEvent } from './actions'

export function DeleteEventButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteEvent}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-danger btn-sm">Eliminar</button>
    </form>
  )
}
