import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import Toast from './Toast'
import { useAuthStore } from '../store/auth'

function AppBar() {
  const logout = useAuthStore((s) => s.logout)
  const mock = useAuthStore((s) => s.mock)
  return (
    <header className="appbar">
      <div className="brand">
        <div className="brand-logo">BNI</div>
        <div>
          <h1>BNI Natcon 2026</h1>
          <p>Jakarta Convention Center</p>
        </div>
      </div>
      <div className="appbar-right">
        {mock && <span className="demo-chip">DEMO</span>}
        <button className="logout-btn" onClick={logout}>
          Keluar
        </button>
      </div>
    </header>
  )
}

function NavButton({ to, icon, label }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = pathname === to
  return (
    <button className={active ? 'active' : ''} onClick={() => navigate(to)}>
      <Icon name={icon} />
      {label}
    </button>
  )
}

export function MemberLayout() {
  return (
    <div className="app-shell">
      <AppBar />
      <div className="screen-body">
        <Outlet />
      </div>
      <nav className="bottomnav">
        <NavButton to="/" icon="home" label="Beranda" />
        <NavButton to="/qr" icon="qr" label="QR Saya" />
        <NavButton to="/passport" icon="pin" label="Passport" />
        <NavButton to="/seminar" icon="mic" label="Seminar" />
      </nav>
      <Toast />
    </div>
  )
}

export function TenantLayout() {
  return (
    <div className="app-shell">
      <AppBar />
      <div className="screen-body">
        <Outlet />
      </div>
      <nav className="bottomnav">
        <NavButton to="/scanner" icon="camera" label="Scanner" />
        <NavButton to="/dashboard" icon="chart" label="Dashboard" />
      </nav>
      <Toast />
    </div>
  )
}
