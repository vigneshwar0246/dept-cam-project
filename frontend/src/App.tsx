import { useState } from 'react'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { initialCameras, initialZones } from './data/mockData'
import { usePersistentState } from './hooks/usePersistentState'
import { Analytics } from './pages/Analytics'
import { CameraManagement } from './pages/CameraManagement'
import { Events } from './pages/Events'
import { LiveMonitoring } from './pages/LiveMonitoring'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Settings } from './pages/Settings'
import type { Camera, PageKey, Zone } from './types'

function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('dot-demo-auth') === 'true' || sessionStorage.getItem('dot-demo-auth') === 'true')
  const [page, setPage] = useState<PageKey>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cameras, setCameras] = usePersistentState<Camera[]>('dot-cameras-v1', initialCameras)
  const [zones, setZones] = usePersistentState<Zone[]>('dot-zones-v1', initialZones)
  const content = page === 'overview' ? <Overview cameras={cameras} zones={zones}/> : page === 'monitoring' ? <LiveMonitoring cameras={cameras}/> : page === 'cameras' ? <CameraManagement cameras={cameras} zones={zones} setCameras={setCameras}/> : page === 'events' ? <Events/> : page === 'analytics' ? <Analytics zones={zones}/> : <Settings zones={zones} setZones={setZones}/>
  const login = (remember: boolean) => { const storage = remember ? localStorage : sessionStorage; storage.setItem('dot-demo-auth', 'true'); setAuthenticated(true) }
  const logout = () => { localStorage.removeItem('dot-demo-auth'); sessionStorage.removeItem('dot-demo-auth'); setAuthenticated(false); setPage('overview') }
  if (!authenticated) return <Login onSuccess={login}/>
  return <DashboardLayout page={page} collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={setPage} onCollapse={() => setCollapsed((value) => !value)} onMobileOpen={() => setMobileOpen(true)} onMobileClose={() => setMobileOpen(false)} onLogout={logout}>{content}</DashboardLayout>
}

export default App
