import { BarChart3, Camera, ChevronLeft, LayoutDashboard, Radio, Settings, ShieldCheck, TableProperties, X } from 'lucide-react'
import type { PageKey } from '../../types'

const navigation: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard }, { key: 'monitoring', label: 'Live Monitoring', icon: Radio },
  { key: 'cameras', label: 'Camera Management', icon: Camera }, { key: 'events', label: 'Events', icon: TableProperties },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 }, { key: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ page, collapsed, mobileOpen, onNavigate, onCollapse, onClose }: { page: PageKey; collapsed: boolean; mobileOpen: boolean; onNavigate: (page: PageKey) => void; onCollapse: () => void; onClose: () => void }) {
  return <><aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
    <div className="brand"><div className="brand-mark"><ShieldCheck size={24} /></div>{!collapsed && <div><strong>Occupancy</strong><span>Department Command</span></div>}<button className="mobile-close icon-button" onClick={onClose}><X size={20} /></button></div>
    <nav aria-label="Primary navigation">{navigation.map(({ key, label, icon: Icon }) => <button key={key} className={page === key ? 'active' : ''} onClick={() => { onNavigate(key); onClose() }} title={collapsed ? label : undefined}><Icon size={19} />{!collapsed && <span>{label}</span>}</button>)}</nav>
    <div className="sidebar-footer">{!collapsed && <div className="demo-panel"><span>DEMO MODE</span><p>Frontend data only</p></div>}<button className="collapse-button" onClick={onCollapse}><ChevronLeft size={18} />{!collapsed && <span>Collapse sidebar</span>}</button></div>
  </aside>{mobileOpen && <div className="drawer-scrim" onClick={onClose} />}</>
}
