import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { MemberLayout, TenantLayout } from './components/Layout'
import Login from './pages/Login'
import Home from './pages/member/Home'
import MyQR from './pages/member/MyQR'
import Passport from './pages/member/Passport'
import Seminars from './pages/member/Seminars'
import Networking from './pages/member/Networking'
import Dashboard from './pages/tenant/Dashboard'

// html5-qrcode besar; muat hanya saat tenant membuka Scanner.
const Scanner = lazy(() => import('./pages/tenant/Scanner'))

// Each app lives under its own path prefix, so a URL always says which
// app it belongs to: /attendee/… for the member pass, /tenant/… for the
// booth scanner. Sign-in is shared at /login.
export const ATTENDEE_HOME = '/attendee'
export const TENANT_HOME = '/tenant/scanner'

export const homeFor = (user) => (user?.role === 'tenant' ? TENANT_HOME : ATTENDEE_HOME)

function RequireRole({ role, children }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />
  return children
}

export default function App() {
  const user = useAuthStore((s) => s.user)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={homeFor(user)} replace /> : <Login />}
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

        {/* Pre-split URLs (bookmarks, installed PWAs) keep working. */}
        <Route path="/qr" element={<Navigate to="/attendee/qr" replace />} />
        <Route path="/passport" element={<Navigate to="/attendee/passport" replace />} />
        <Route path="/seminar" element={<Navigate to="/attendee/seminar" replace />} />
        <Route path="/network" element={<Navigate to="/attendee/network" replace />} />
        <Route path="/scanner" element={<Navigate to="/tenant/scanner" replace />} />
        <Route path="/dashboard" element={<Navigate to="/tenant/dashboard" replace />} />

        <Route
          path="*"
          element={<Navigate to={user ? homeFor(user) : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
