import { QRCodeSVG } from 'qrcode.react'
import Icon from '../../components/Icon'
import { scanCode } from '../../pass'
import { useAuthStore } from '../../store/auth'

export default function MyQR() {
  const user = useAuthStore((s) => s.user)
  const code = scanCode(user)

  return (
    <div className="qr-page">
      <div className="qr-card">
        <div className="pill red" style={{ marginBottom: 14 }}>
          <Icon name="qr" size={13} />
          MEMBER PASS
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {code && <QRCodeSVG value={code} size={190} />}
        </div>
        <div className="qp-name">{user?.name}</div>
        <div className="qp-sub">
          {user?.chapter}
          {user?.company ? ` · ${user.company}` : ''}
        </div>
        <div className="qp-id">{user?.member_code}</div>
        {user?.ticket_number && <div className="qp-ticket">Ticket {user.ticket_number}</div>}
      </div>

      <div className="qr-uses">
        <div className="section-title" style={{ margin: '18px 0 4px' }}>
          What this QR is for
        </div>
        <div className="qr-use">
          <div className="qu-ic">
            <Icon name="store" size={17} />
          </div>
          <div>
            <h5>Booth Visits</h5>
            <p>Scanned by sponsors &amp; booths — collect stamps, win the grand prize</p>
          </div>
        </div>
        <div className="qr-use">
          <div className="qu-ic">
            <Icon name="mic" size={17} />
          </div>
          <div>
            <h5>Class Entry</h5>
            <p>
              Two sessions — pick the class you like, seats are limited. Your class entry QR lives on
              the Learning Class page
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
