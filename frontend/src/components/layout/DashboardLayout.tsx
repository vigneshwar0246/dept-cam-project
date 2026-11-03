import type { ReactNode } from 'react'
import type { PageKey } from '../../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function DashboardLayout({ page, collapsed, mobileOpen, onNavigate, onCollapse, onMobileOpen, onMobileClose, onLogout, children }: { page: PageKey; collapsed: boolean; mobileOpen: boolean; onNavigate: (page: PageKey) => void; onCollapse: () => void; onMobileOpen: () => void; onMobileClose: () => void; onLogout: () => void; children: ReactNode }) {
  return <div className={`app-shell ${collapsed ? 'shell-collapsed' : ''}`}><Sidebar page={page} collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={onNavigate} onCollapse={onCollapse} onClose={onMobileClose} /><div className="workspace"><Topbar page={page} onMenu={onMobileOpen} onLogout={onLogout}/><main>{children}</main></div></div>
}
