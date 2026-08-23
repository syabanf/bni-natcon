import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import Toast from './Toast'
import Tour from './Tour'
import { useTourStore } from '../store/tour'
import { useAuthStore } from '../store/auth'

function AppBar({ backTo, tour = false }) {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const startTour = useTourStore((s) => s.start)
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
        {/* Next to Log out, on every attendee screen — the two things you
            reach for when you are not sure what to do next. */}
        {tour && (
          <button className="tour-btn" onClick={startTour}>
            <Icon name="award" size={13} />
            Quick tour
          </button>
        )}
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
  // While the tour is running the bar below gets a ring on the tab it is
  // talking about, so the words and the screen point at the same thing.
  const touring = useTourStore((s) => s.open)
  return (
    <div className={`app-shell${touring ? ' tour-open' : ''}`}>
      <AppBar backTo="/login" tour />
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
      <Tour />
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
