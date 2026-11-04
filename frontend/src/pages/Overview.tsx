import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  DoorOpen,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AnalyticsPoint,
  Camera as CameraType,
  OccupancyEvent,
  OccupancyState,
  Zone,
} from "../types";
import { StatusBadge } from "../components/common/StatusBadge";

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone?: string;
}) {
  return (
    <article className="metric">
      <div className={`metric-icon ${tone}`}>
        <Icon size={20} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}
export function Overview({
  cameras,
  zones,
  events,
  trend,
  occupancy: states,
  loading,
  error,
  socketOnline,
  onRefresh,
}: {
  cameras: CameraType[];
  zones: Zone[];
  events: OccupancyEvent[];
  trend: AnalyticsPoint[];
  occupancy: OccupancyState[];
  loading: boolean;
  error: string;
  socketOnline: boolean;
  onRefresh: () => Promise<void>;
}) {
  const occupancy = zones.reduce((sum, zone) => sum + zone.occupancy, 0);
  const capacity = zones.reduce((sum, zone) => sum + zone.capacity, 0);
  const entries = states.reduce((sum, row) => sum + row.entries, 0);
  const exits = states.reduce((sum, row) => sum + row.exits, 0);
  const chart = trend.map((row) => ({
    time: row.period.slice(11, 16) || row.period,
    occupancy: row.entries - row.exits,
  }));
  const colors = ["#dc2626", "#ef4444", "#f87171", "#fca5a5", "#fecaca"];
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <div className="eyebrow">
            <span className={socketOnline ? "live-dot" : "dot red"} />
            {socketOnline ? "LIVE OPERATIONS" : "REAL-TIME DISCONNECTED"}
          </div>
          <h2>Department Overview</h2>
          <p>
            {error ||
              (loading
                ? "Loading backend data…"
                : "Authoritative data from FastAPI and MongoDB.")}
          </p>
        </div>
        <button className="button secondary" onClick={() => void onRefresh()}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </section>
      <section className="metrics-grid">
        <Metric
          label="Current occupancy"
          value={String(occupancy)}
          detail="Across backend zones"
          icon={Users}
        />
        <Metric
          label="Total entries"
          value={String(entries)}
          detail="Backend zone totals"
          icon={ArrowUpRight}
          tone="green"
        />
        <Metric
          label="Total exits"
          value={String(exits)}
          detail="Backend zone totals"
          icon={ArrowDownRight}
          tone="red"
        />
        <Metric
          label="Active cameras"
          value={`${cameras.filter((item) => item.status === "Online").length} / ${cameras.length}`}
          detail="Configured camera sources"
          icon={Camera}
        />
        <Metric
          label="Display capacity"
          value={
            capacity ? `${Math.round((occupancy / capacity) * 100)}%` : "—"
          }
          detail="Capacity is browser-local"
          icon={DoorOpen}
          tone="amber"
        />
      </section>
      <section className="dashboard-grid">
        <article className="panel chart-panel span-2">
          <div className="panel-heading">
            <div>
              <h3>Net hourly movement</h3>
              <p>Entries minus exits from recorded events</p>
            </div>
          </div>
          {chart.length ? (
            <div className="chart-large">
              <ResponsiveContainer>
                <AreaChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="occupancy"
                    stroke="#dc2626"
                    fill="#fee2e2"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No historical events</h3>
              <p>
                The chart will populate after entry or exit events are recorded.
              </p>
            </div>
          )}
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Occupancy distribution</h3>
              <p>Current backend state</p>
            </div>
          </div>
          {zones.length ? (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={zones}
                      dataKey="occupancy"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={88}
                    >
                      {zones.map((zone, index) => (
                        <Cell
                          key={zone.id}
                          fill={colors[index % colors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>{occupancy}</strong>
                  <span>people</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>No zones found</h3>
            </div>
          )}
        </article>
        <article className="panel span-2">
          <div className="panel-heading">
            <div>
              <h3>Current occupancy by zone</h3>
              <p>Capacity values are local display preferences</p>
            </div>
          </div>
          <div className="zone-list">
            {zones.map((zone) => {
              const percent = Math.min(
                100,
                Math.round((zone.occupancy / zone.capacity) * 100),
              );
              return (
                <div key={zone.id}>
                  <div>
                    <strong>{zone.name}</strong>
                    <span>
                      {zone.occupancy} / {zone.capacity}
                    </span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Camera health</h3>
              <p>Actual capture status</p>
            </div>
          </div>
          <div className="health-list">
            {cameras.slice(0, 4).map((camera) => (
              <div key={camera.id}>
                <div className="camera-glyph">
                  <Camera size={17} />
                </div>
                <div>
                  <strong>{camera.name}</strong>
                  <span>
                    {camera.zone} · {camera.lastActive}
                  </span>
                </div>
                <StatusBadge value={camera.status} />
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Recent events</h3>
            <p>Anonymous line-crossing activity</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Camera</th>
                <th>Zone</th>
                <th>Event</th>
                <th>Tracking ID</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 6).map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.timestamp).toLocaleString()}</td>
                  <td>{event.camera}</td>
                  <td>{event.zone}</td>
                  <td>
                    <span className={`event-type ${event.type.toLowerCase()}`}>
                      {event.type}
                    </span>
                  </td>
                  <td className="mono">{event.trackingId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!events.length && (
          <div className="table-empty">No events have been recorded.</div>
        )}
      </section>
    </div>
  );
}
