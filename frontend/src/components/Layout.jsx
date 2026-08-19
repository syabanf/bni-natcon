import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import Toast from './Toast'
import { useAuthStore } from '../store/auth'

function AppBar({ backTo }) {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const mock = useAuthStore((s) => s.mock)
  // Signing out drops you at the door you came in by, so a booth crew is not
  // handed the attendee sign-in mid-event.
  const signOut = () => {
    logout()
    navigate(backTo, { replace: true })
  }
  return (
    <header className="appbar">
      <div className="brand">
        <img className="brand-logo" src="/brand/logo-horizontal.png" alt="BNI Indonesia National Conference 2026 — Accelerate" />
      </div>
      <div className="appbar-right">
        {mock && <span className="demo-chip">DEMO</span>}
        <button className="logout-btn" onClick={signOut}>
          Log out
        </button>
      </div>
    </header>
  )
}

// Build credit, at the foot of every screen.
export function WitCredit() {
  return (
    <p className="wit-credit">
      System by{' '}
      <a href="https://wit.id" target="_blank" rel="noreferrer">
        WIT
      </a>
    </p>
  )
}

function NavButton({ to, icon, label }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = pathname === to
  return (
    <button className={active ? 'active' : ''} onClick={() => navigate(to)}>
      <Icon name={icon} />
      <span className="nav-label">{label}</span>
    </button>
  )
}

export function MemberLayout() {
  return (
    <div className="app-shell">
      <AppBar backTo="/login" />
      <div className="screen-body">
        <Outlet />
        <WitCredit />
      </div>
      <nav className="bottomnav">
        <NavButton to="/attendee" icon="home" label="Home" />
        <NavButton to="/attendee/qr" icon="qr" label="My QR" />
        <NavButton to="/attendee/passport" icon="pin" label="Passport" />
        <NavButton to="/attendee/seminar" icon="mic" label="Learning Class" />
        <NavButton to="/attendee/network" icon="users" label="Network" />
      </nav>
      <Toast />
    </div>
  )
}

export function TenantLayout() {
  return (
    <div className="app-shell">
      <AppBar backTo="/tenant/login" />
      <div className="screen-body">
        <Outlet />
        <WitCredit />
      </div>
      <nav className="bottomnav">
        <NavButton to="/tenant/scanner" icon="camera" label="Scanner" />
        <NavButton to="/tenant/dashboard" icon="chart" label="Dashboard" />
      </nav>
      <Toast />
    </div>
  )
}
