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

function RequireRole({ role, children }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) {
    return <Navigate to={user.role === 'tenant' ? '/scanner' : '/'} replace />
  }
  return children
}

export default function App() {
  const user = useAuthStore((s) => s.user)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={user.role === 'tenant' ? '/scanner' : '/'} replace /> : <Login />}
        />

        <Route
          element={
            <RequireRole role="member">
              <MemberLayout />
            </RequireRole>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/qr" element={<MyQR />} />
          <Route path="/passport" element={<Passport />} />
          <Route path="/seminar" element={<Seminars />} />
          <Route path="/network" element={<Networking />} />
        </Route>

        <Route
          element={
            <RequireRole role="tenant">
              <TenantLayout />
            </RequireRole>
          }
        >
          <Route
            path="/scanner"
            element={
              <Suspense fallback={<div className="loading-note">Menyiapkan scanner…</div>}>
                <Scanner />
              </Suspense>
            }
          />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
