import { useState } from 'react'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { initialCameras, initialZones } from './data/mockData'
import { usePersistentState } from './hooks/usePersistentState'
import { Analytics } from './pages/Analytics'
import { CameraManagement } from './pages/CameraManagement'
import { Events } from './pages/Events'
import { LiveMonitoring } from './pages/LiveMonitoring'
import { Overview } from './pages/Overview'
import { Settings } from './pages/Settings'
import type { Camera, PageKey, Zone } from './types'

function App() {
  const [page, setPage] = useState<PageKey>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cameras, setCameras] = usePersistentState<Camera[]>('dot-cameras-v1', initialCameras)
  const [zones, setZones] = usePersistentState<Zone[]>('dot-zones-v1', initialZones)
  const content = page === 'overview' ? <Overview cameras={cameras} zones={zones}/> : page === 'monitoring' ? <LiveMonitoring cameras={cameras}/> : page === 'cameras' ? <CameraManagement cameras={cameras} zones={zones} setCameras={setCameras}/> : page === 'events' ? <Events/> : page === 'analytics' ? <Analytics zones={zones}/> : <Settings zones={zones} setZones={setZones}/>
  return <DashboardLayout page={page} collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={setPage} onCollapse={() => setCollapsed((value) => !value)} onMobileOpen={() => setMobileOpen(true)} onMobileClose={() => setMobileOpen(false)}>{content}</DashboardLayout>
}

export default App
