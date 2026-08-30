import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { MemberLayout, TenantLayout } from './components/Layout'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import WrongApp from './pages/WrongApp'
import Landing from './pages/Landing'
import Home from './pages/member/Home'
import MyQR from './pages/member/MyQR'
import Passport from './pages/member/Passport'
import Seminars from './pages/member/Seminars'
import Networking from './pages/member/Networking'
import Profile from './pages/member/Profile'
import Dashboard from './pages/tenant/Dashboard'

// html5-qrcode besar; muat hanya saat tenant membuka Scanner.
const Scanner = lazy(() => import('./pages/tenant/Scanner'))

// Each app lives under its own path prefix, so a URL always says which
// app it belongs to: /attendee/… for the member pass, /tenant/… for the
// booth scanner. Sign-in is shared at /login.
export const ATTENDEE_HOME = '/attendee'
export const TENANT_HOME = '/tenant/scanner'

// Each role also has its own sign-in door, so a booth crew that logs out
// lands back on the booth entrance rather than the attendee one.
export const ATTENDEE_LOGIN = '/login'
export const TENANT_LOGIN = '/tenant/login'

// Only two roles have somewhere to be in this app. A door crew or committee
// account signing in here has NO home — answering with ATTENDEE_HOME sent
// them to the page that refuses them, which then sent them back again: a
// blank screen and an endless redirect. null means "say so instead".
export const homeFor = (user) => {
  if (user?.role === 'tenant') return TENANT_HOME
  if (user?.role === 'member') return ATTENDEE_HOME
  return null
}
export const loginFor = (role) => (role === 'tenant' ? TENANT_LOGIN : ATTENDEE_LOGIN)

function RequireRole({ role, children }) {
  const user = useAuthStore((s) => s.user)
  // Send them to the door they came from, not always the attendee one.
  if (!user) return <Navigate to={loginFor(role)} replace />
  // Still on the password generated at import time: nothing else opens until
  // they pick their own.
  // Both first-run gates live on one screen: a password of their own, and
  // agreement to the data notice. Either one outstanding keeps the app shut.
  if (user.must_set_password || user.must_consent) return <SetPassword />
  if (user.role !== role) {
    const home = homeFor(user)
    return home ? <Navigate to={home} replace /> : <WrongApp />
  }
  return children
}

// Signed in, but with nowhere to go in this app.
function HomeOrExplain({ user }) {
  const home = homeFor(user)
  return home ? <Navigate to={home} replace /> : <WrongApp />
}

export default function App() {
  const user = useAuthStore((s) => s.user)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path={ATTENDEE_LOGIN}
          element={user ? <HomeOrExplain user={user} /> : <Login audience="attendee" />}
        />
        <Route
          path={TENANT_LOGIN}
          element={user ? <HomeOrExplain user={user} /> : <Login audience="tenant" />}
        />

        <Route
          element={
            <RequireRole role="member">
              <MemberLayout />
            </RequireRole>
          }
        >
          <Route path="/attendee" element={<Home />} />
          <Route path="/attendee/qr" element={<MyQR />} />
          <Route path="/attendee/passport" element={<Passport />} />
          <Route path="/attendee/seminar" element={<Seminars />} />
          <Route path="/attendee/network" element={<Networking />} />
          <Route path="/attendee/profile" element={<Profile />} />
        </Route>

        <Route
          element={
            <RequireRole role="tenant">
              <TenantLayout />
            </RequireRole>
          }
        >
          <Route
            path="/tenant/scanner"
            element={
              <Suspense fallback={<div className="loading-note">Starting the scanner…</div>}>
                <Scanner />
              </Suspense>
            }
          />
          <Route path="/tenant/dashboard" element={<Dashboard />} />
        </Route>

        {/* The front door: the poster with the countdown. Deliberately shown
            to signed-in people too — the address on the printed material is
            the landing, and their way in is one tap further. */}
        <Route path="/" element={<Landing />} />

        {/* Pre-split URLs (bookmarks, installed PWAs) keep working. */}
        <Route path="/countdown" element={<Navigate to="/" replace />} />
        <Route path="/qr" element={<Navigate to="/attendee/qr" replace />} />
        <Route path="/passport" element={<Navigate to="/attendee/passport" replace />} />
        <Route path="/seminar" element={<Navigate to="/attendee/seminar" replace />} />
        <Route path="/network" element={<Navigate to="/attendee/network" replace />} />
        <Route path="/scanner" element={<Navigate to="/tenant/scanner" replace />} />
        <Route path="/dashboard" element={<Navigate to="/tenant/dashboard" replace />} />

        <Route
          path="*"
          element={user ? <HomeOrExplain user={user} /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
