import { QRCodeSVG } from 'qrcode.react'
import Icon from '../../components/Icon'
import { useAuthStore } from '../../store/auth'

export default function MyQR() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="qr-page">
      <div className="qr-card">
        <div className="pill red" style={{ marginBottom: 14 }}>
          <Icon name="qr" size={13} />
          MEMBER PASS
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {user?.member_code && <QRCodeSVG value={user.member_code} size={190} />}
        </div>
        <div className="qp-name">{user?.name}</div>
        <div className="qp-sub">
          {user?.chapter}
          {user?.company ? ` · ${user.company}` : ''}
        </div>
        <div className="qp-id">{user?.member_code}</div>
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
            <p>Scanned by sponsors &amp; booths — collect pins for every visit</p>
          </div>
        </div>
        <div className="qr-use">
          <div className="qu-ic">
            <Icon name="mic" size={17} />
          </div>
          <div>
            <h5>Class Entry</h5>
            <p>Your class entry QR lives on the Learning Class page — separate from this one</p>
          </div>
        </div>
      </div>
    </div>
  )
}
