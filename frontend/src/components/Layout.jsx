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
        <img className="brand-logo" src="/brand/logo-horizontal.png" alt="BNI Indonesia National Conference 2026 — Accelerate" />
        <p className="brand-place">Jakarta Convention Center</p>
      </div>
      <div className="appbar-right">
        {mock && <span className="demo-chip">DEMO</span>}
        <button className="logout-btn" onClick={logout}>
          Log out
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
        <NavButton to="/attendee" icon="home" label="Home" />
        <NavButton to="/attendee/qr" icon="qr" label="My QR" />
        <NavButton to="/attendee/passport" icon="pin" label="Passport" />
        <NavButton to="/attendee/seminar" icon="mic" label="Seminar" />
        <NavButton to="/attendee/network" icon="users" label="Network" />
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
        <NavButton to="/tenant/scanner" icon="camera" label="Scanner" />
        <NavButton to="/tenant/dashboard" icon="chart" label="Dashboard" />
      </nav>
      <Toast />
    </div>
  )
}
