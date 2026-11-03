import { Bell, LogOut, Menu, Search } from 'lucide-react'
import type { PageKey } from '../../types'

const titles: Record<PageKey, string> = { overview: 'Overview', monitoring: 'Live Monitoring', cameras: 'Camera Management', events: 'Occupancy Events', analytics: 'Occupancy Analytics', settings: 'Settings' }

export function Topbar({ page, onMenu, onLogout }: { page: PageKey; onMenu: () => void; onLogout: () => void }) {
  const now = new Date()
  return <header className="topbar"><div className="topbar-title"><button className="menu-button icon-button" onClick={onMenu}><Menu size={20} /></button><div><span>Department / {titles[page]}</span><h1>{titles[page]}</h1></div></div><div className="topbar-actions"><label className="global-search"><Search size={17} /><input aria-label="Global search" placeholder="Search dashboard" /></label><div className="system-indicator"><span />All systems operational</div><time>{now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}<small>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small></time><button className="icon-button notification" aria-label="Notifications"><Bell size={19} /><span /></button><div className="avatar" title="Department Administrator">DA</div><button className="icon-button logout-button" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={18}/></button></div></header>
}
