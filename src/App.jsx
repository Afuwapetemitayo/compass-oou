import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './state'
import Icon from './components/Icon'
import { CompassMark } from './components/ui'
import { Welcome, Signup, SignIn, Verify } from './pages/Auth'
import { Home, Directory, Place, Faq } from './pages/Main'
import MapPage from './pages/MapPage'
import Admin from './pages/Admin'
import Privacy from './pages/Privacy'

const TABS = [['/', 'Home', 'home'], ['/map', 'Map', 'map'], ['/directory', 'Directory', 'list'], ['/faq', 'FAQ', 'help']]

function Tabs() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const cur = pathname.startsWith('/place/') ? '/directory' : pathname
  return (
    <nav id="tabs" aria-label="Main">
      <div className="brand"><span className="bm"><CompassMark size={22} /></span><b>Compass</b></div>
      {TABS.map(([to, label, icon]) => (
        <button key={to} onClick={() => nav(to)} aria-current={cur === to ? 'page' : undefined}>
          <Icon n={icon} /><span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const { toastMsg, hasSupabase } = useApp()
  const showTabs = ['/', '/directory', '/faq', '/map'].includes(pathname) || pathname.startsWith('/place/')
  return (
    <div id="app" className={hasSupabase ? undefined : 'has-banner'}>
      {!hasSupabase && <div className="banner" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60 }}>Test mode: accounts and edits stay on this device only</div>}
      <Outlet />
      {showTabs && <Tabs />}
      {toastMsg && <div className={pathname === '/map' ? 'toast top' : 'toast'}>{toastMsg}</div>}
    </div>
  )
}

const profileDone = p => p && p.fac && p.dep

function Splash() {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}><span style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--blue)', display: 'grid', placeItems: 'center' }}><CompassMark size={30} /></span></div>
}

// Signed-in pages only. Sends people to the right step if something is missing.
function RequireAuth({ admin }) {
  const { session, ready, profile, isAdmin } = useApp()
  if (session === undefined || !ready) return <Splash />
  if (!session) return <Navigate to="/welcome" replace />
  if (!profileDone(profile)) return <Navigate to="/signup?complete=1" replace />
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

// Welcome / sign in pages: if you are already in, go home.
function PublicOnly() {
  const { session, ready, profile } = useApp()
  if (session === undefined || (session && !ready)) return <Splash />
  if (session && profileDone(profile)) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<PublicOnly />}>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/verify" element={<Verify />} />
        </Route>
        <Route path="/signup" element={<Signup />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Home />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/place/:slug" element={<Place />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/faq" element={<Faq />} />
        </Route>
        <Route element={<RequireAuth admin />}>
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
