import { ArrowDownRight, ArrowUpRight, Camera, DoorOpen, RefreshCw, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { events, occupancyTrend } from '../data/mockData'
import type { Camera as CameraType, Zone } from '../types'
import { StatusBadge } from '../components/common/StatusBadge'

function Metric({ label, value, detail, icon: Icon, tone = '' }: { label: string; value: string; detail: string; icon: typeof Users; tone?: string }) {
  return <article className="metric"><div className={`metric-icon ${tone}`}><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}

export function Overview({ cameras, zones }: { cameras: CameraType[]; zones: Zone[] }) {
  const occupancy = zones.reduce((sum, zone) => sum + zone.occupancy, 0)
  const capacity = zones.reduce((sum, zone) => sum + zone.capacity, 0)
  const colors = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca']
  return <div className="page-stack">
    <section className="page-intro"><div><div className="eyebrow"><span className="live-dot" />LIVE OPERATIONS</div><h2>Department Overview</h2><p>Real-time occupancy monitoring and security insights. Demo values are shown.</p></div><div className="intro-actions"><input type="date" defaultValue="2026-11-03" /><button className="button secondary"><RefreshCw size={17} />Refresh</button></div></section>
    <section className="metrics-grid">
      <Metric label="Current occupancy" value={String(occupancy)} detail="↑ 8.4% from yesterday" icon={Users} />
      <Metric label="Total entries today" value="284" detail="↑ 24 this hour" icon={ArrowUpRight} tone="green" />
      <Metric label="Total exits today" value="172" detail="↓ 17 this hour" icon={ArrowDownRight} tone="red" />
      <Metric label="Active cameras" value={`${cameras.filter((camera) => camera.status === 'Online').length} / ${cameras.length}`} detail="1 requires attention" icon={Camera} />
      <Metric label="Department capacity" value={`${Math.round(occupancy / capacity * 100)}%`} detail={`${occupancy} of ${capacity} occupied`} icon={DoorOpen} tone="amber" />
    </section>
    <section className="dashboard-grid"><article className="panel chart-panel span-2"><div className="panel-heading"><div><h3>Occupancy trend</h3><p>People present across all monitored zones</p></div><div className="segmented"><button className="active">Today</button><button>7 Days</button><button>30 Days</button></div></div><div className="chart-large"><ResponsiveContainer><AreaChart data={occupancyTrend}><defs><linearGradient id="redFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dc2626" stopOpacity={0.2}/><stop offset="100%" stopColor="#dc2626" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb"/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Area type="monotone" dataKey="occupancy" stroke="#dc2626" strokeWidth={2.5} fill="url(#redFill)"/></AreaChart></ResponsiveContainer></div></article>
      <article className="panel"><div className="panel-heading"><div><h3>Occupancy distribution</h3><p>Share by department zone</p></div></div><div className="donut-wrap"><ResponsiveContainer width="100%" height={210}><PieChart><Pie data={zones} dataKey="occupancy" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2}>{zones.map((zone, index) => <Cell key={zone.id} fill={colors[index % colors.length]} />)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{occupancy}</strong><span>people</span></div></div><div className="legend-list">{zones.map((zone, index) => <div key={zone.id}><span style={{ background: colors[index] }} />{zone.name}<strong>{zone.occupancy}</strong></div>)}</div></article>
      <article className="panel span-2"><div className="panel-heading"><div><h3>Current occupancy by zone</h3><p>Live utilization against configured capacity</p></div></div><div className="zone-list">{zones.map((zone) => { const percent = Math.round(zone.occupancy / zone.capacity * 100); return <div key={zone.id}><div><strong>{zone.name}</strong><span className={percent >= 80 ? 'warning-text' : ''}>{zone.occupancy} / {zone.capacity}</span></div><div className="progress"><span className={percent >= 80 ? 'warning' : ''} style={{ width: `${percent}%` }} /></div></div>})}</div></article>
      <article className="panel"><div className="panel-heading"><div><h3>Camera health</h3><p>Current network status</p></div><button className="text-button">View all</button></div><div className="health-list">{cameras.slice(0, 4).map((camera) => <div key={camera.id}><div className="camera-glyph"><Camera size={17}/></div><div><strong>{camera.name}</strong><span>{camera.zone} · {camera.lastActive}</span></div><StatusBadge value={camera.status} /></div>)}</div></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><h3>Recent events</h3><p>Latest anonymous line-crossing activity</p></div><button className="text-button">View event log</button></div><div className="table-scroll"><table><thead><tr><th>Time</th><th>Camera</th><th>Zone</th><th>Event</th><th>Tracking ID</th><th>Status</th></tr></thead><tbody>{events.slice(0, 6).map((event) => <tr key={event.id}><td>{event.timestamp.split(' ')[1]}</td><td>{event.camera}</td><td>{event.zone}</td><td><span className={`event-type ${event.type.toLowerCase()}`}>{event.type}</span></td><td className="mono">{event.trackingId}</td><td><StatusBadge value={event.status}/></td></tr>)}</tbody></table></div></section>
  </div>
}
