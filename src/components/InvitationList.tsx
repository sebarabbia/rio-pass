import { voidInvitation } from '@/actions/invitations'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { ShareInvitation } from '@/components/ShareInvitation'

export type InvitationRow = {
  id: string
  code: string
  holder_name: string | null
  holder_email: string | null
  holder_phone: string | null
  status: 'valido' | 'usado' | 'anulado'
  sector: string | null
  issuer?: string | null
}

const STATUS = {
  valido: { label: 'Válido', pill: 'pill-ok' },
  usado: { label: 'Usado', pill: 'pill-muted' },
  anulado: { label: 'Anulado', pill: 'pill-bad' },
} as const

type Props = {
  rows: InvitationRow[]
  eventId: string
  eventName: string
  when: string
  origin: string
  showIssuer?: boolean
}

export function InvitationList({ rows, eventId, eventName, when, origin, showIssuer }: Props) {
  if (rows.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">Todavía no hay invitaciones</p>
        <p>Las que generes van a aparecer acá para reenviarlas o anularlas.</p>
      </div>
    )
  }

  return (
    <ul className="list">
      {rows.map((row) => {
        const name = row.holder_name ?? 'Invitado'
        const contact = [row.holder_phone, row.holder_email].filter(Boolean).join(' · ')
        return (
          <li key={row.id} className={`card invitation${row.status === 'anulado' ? ' is-void' : ''}`}>
            <div className="row">
              <div className="invitation-info">
                <p className="card-title">{name}</p>
                <p className="muted small">
                  {[row.sector, contact, showIssuer && row.issuer ? `por ${row.issuer}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={`pill ${STATUS[row.status].pill}`}>{STATUS[row.status].label}</span>
            </div>
            {row.status === 'valido' && (
              <div className="invitation-actions">
                <ShareInvitation
                  url={`${origin}/qr/${row.code}`}
                  holderName={name}
                  phone={row.holder_phone}
                  eventName={eventName}
                  when={when}
                  compact
                />
                <form action={voidInvitation}>
                  <input type="hidden" name="ticketId" value={row.id} />
                  <input type="hidden" name="eventId" value={eventId} />
                  <ConfirmSubmit message={`¿Anular el QR de ${name}? Ya no va a poder entrar con él.`} className="btn btn-danger btn-sm">
                    Anular
                  </ConfirmSubmit>
                </form>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
