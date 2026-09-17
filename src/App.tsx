import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useApp } from './state/AppState'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Capture } from './screens/Capture'
import { Style } from './screens/Style'
import { Closet } from './screens/Closet'
import { Shop } from './screens/Shop'
import { Friends } from './screens/Friends'
import { Profile } from './screens/Profile'

const TABS = [
  { to: '/closet', label: 'Closet', icon: '▤' },
  { to: '/home', label: 'Style', icon: '✦' },
  { to: '/shop', label: 'Needs', icon: '⌕' },
  { to: '/friends', label: 'Friends', icon: '◎' },
]

function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="ico">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Entry routing enforces the flow described in the product brief: first-time
 * users land on activation, returning users always land on the closet.
 */
function Landing() {
  const { data } = useApp()
  if (!data.profile) return <Navigate to="/welcome" replace />
  if (data.hasCompletedFirstSession || data.outfits.length > 0) return <Navigate to="/closet" replace />
  return <Navigate to="/home" replace />
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const { data } = useApp()
  if (!data.profile) return <Navigate to="/welcome" replace />
  return <>{children}</>
}

export default function App() {
  const location = useLocation()
  const showTabs = location.pathname !== '/welcome' && location.pathname !== '/'

  return (
    <div className="device">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/welcome" element={<Onboarding />} />
        <Route
          path="/home"
          element={
            <RequireProfile>
              <Home />
            </RequireProfile>
          }
        />
        <Route
          path="/capture"
          element={
            <RequireProfile>
              <Capture />
            </RequireProfile>
          }
        />
        <Route
          path="/style"
          element={
            <RequireProfile>
              <Style />
            </RequireProfile>
          }
        />
        <Route
          path="/closet"
          element={
            <RequireProfile>
              <Closet />
            </RequireProfile>
          }
        />
        <Route
          path="/shop"
          element={
            <RequireProfile>
              <Shop />
            </RequireProfile>
          }
        />
        <Route
          path="/friends"
          element={
            <RequireProfile>
              <Friends />
            </RequireProfile>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireProfile>
              <Profile />
            </RequireProfile>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showTabs ? <TabBar /> : null}
    </div>
  )
}
