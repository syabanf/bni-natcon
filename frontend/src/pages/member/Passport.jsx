import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { api } from '../../api/client'

export default function Passport() {
  const [tenants, setTenants] = useState(null)

  useEffect(() => {
    api
      .tenants()
      .then((data) => setTenants(data.tenants || []))
      .catch(() => setTenants([]))
  }, [])

  if (tenants === null) {
    return <div className="loading-note">Memuat daftar tenant…</div>
  }

  const visited = tenants.filter((t) => t.visited).length
  const total = tenants.length
  const pct = total ? Math.round((visited / total) * 100) : 0

  return (
    <>
      <div className="hero-greet">
        <h2>Tenant Passport</h2>
        <p>Kunjungi booth, minta tenant scan QR-mu. Tanpa stempel, tanpa kertas.</p>
      </div>
      <div style={{ height: 14 }} />

      <div className="card progress-card">
        <div className="progress-head">
          <h4>Progres kunjungan</h4>
          <span>
            {visited} dari {total} tenant
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-note">
          Setiap tenant yang men-scan QR-mu = <b>1 kupon door prize</b>. Kunjungi semua {total} tenant
          untuk peluang terbesar memenangkan grand prize di Gala Dinner.
        </div>
      </div>

      <div className="doorprize-banner">
        <div className="db-ic">
          <Icon name="award" size={19} />
        </div>
        <div>
          <h5>Kupon kamu: {visited}</h5>
          <p>Undian door prize ditarik pukul 19:30 di Plenary Hall</p>
        </div>
      </div>

      <div className="section-title" style={{ marginLeft: 20 }}>
        Daftar Tenant
      </div>
      <div className="tenant-grid">
        {tenants.map((t) => (
          <div key={t.id} className={`tenant-card${t.visited ? ' scanned' : ''}`}>
            <div className="t-check">
              <Icon name="check" size={12} />
            </div>
            <div className="t-logo">{t.initials}</div>
            <h5>{t.name}</h5>
            <p>
              {t.category} · Booth {t.booth}
            </p>
            <div className="t-status">
              {t.visited ? (
                <span className="pill green">Sudah di-scan</span>
              ) : (
                <span className="pill gray">Belum dikunjungi</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 24 }} />
    </>
  )
}
