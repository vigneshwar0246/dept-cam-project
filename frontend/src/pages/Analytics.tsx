import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsPoint, OccupancyState, Zone } from "../types";
import { exportCsv } from "../utils/csvExport";
export function Analytics({
  zones,
  daily,
  hourly,
  peaks,
  occupancy,
}: {
  zones: Zone[];
  daily: AnalyticsPoint[];
  hourly: AnalyticsPoint[];
  peaks: AnalyticsPoint[];
  occupancy: OccupancyState[];
}) {
  const totalEntries = occupancy.reduce((s, r) => s + r.entries, 0),
    totalExits = occupancy.reduce((s, r) => s + r.exits, 0),
    busiest = peaks[0];
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <div className="eyebrow">BACKEND ANALYTICS</div>
          <h2>Occupancy Analytics</h2>
          <p>Historical results calculated from persisted events.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => exportCsv("occupancy-analytics.csv", daily.map((row) => ({ period: row.period, entries: row.entries, exits: row.exits })))}
        >
          <Download size={17} />
          Export CSV
        </button>
      </section>
      <section className="insight-grid">
        <article>
          <span>Recorded days</span>
          <strong>{daily.length}</strong>
          <small>Available history</small>
        </article>
        <article>
          <span>Busiest hour</span>
          <strong>{busiest?.period.slice(11, 16) || "—"}</strong>
          <small>
            {busiest ? busiest.entries + busiest.exits : 0} movements
          </small>
        </article>
        <article>
          <span>Most occupied zone</span>
          <strong>
            {[...zones].sort((a, b) => b.occupancy - a.occupancy)[0]?.name ||
              "—"}
          </strong>
          <small>Current state</small>
        </article>
        <article>
          <span>Total entries</span>
          <strong>{totalEntries}</strong>
          <small>Zone counters</small>
        </article>
        <article>
          <span>Total exits</span>
          <strong>{totalExits}</strong>
          <small>Zone counters</small>
        </article>
      </section>
      <section className="analytics-grid">
        <Chart title="Daily entries and exits" empty={!daily.length}>
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="entries" fill="#dc2626" />
              <Bar dataKey="exits" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Hourly activity" empty={!hourly.length}>
          <ResponsiveContainer>
            <LineChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Line dataKey="entries" stroke="#dc2626" />
              <Line dataKey="exits" stroke="#64748b" />
            </LineChart>
          </ResponsiveContainer>
        </Chart>
      </section>
    </div>
  );
}
function Chart({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <h3>{title}</h3>
      </div>
      {empty ? (
        <div className="empty-state">
          <h3>No historical data</h3>
          <p>Analytics appear after events are recorded.</p>
        </div>
      ) : (
        <div className="chart-medium">{children}</div>
      )}
    </article>
  );
}
