import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "../components/common/Modal";
import type { OccupancyEvent } from "../types";
import { exportCsv } from "../utils/csvExport";
export function Events({
  events,
  loading,
}: {
  events: OccupancyEvent[];
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All events");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OccupancyEvent | null>(null);
  const size = 10;
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (type === "All events" || e.type === type) &&
          `${e.camera} ${e.zone} ${e.trackingId}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [events, query, type],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const visible = filtered.slice((page - 1) * size, page * size);
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <h2>Occupancy Events</h2>
          <p>
            {loading
              ? "Loading events…"
              : "Anonymous crossing events from the backend."}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            exportCsv(
              "occupancy-events.csv",
              filtered.map((e) => ({ ...e })),
            )
          }
        >
          <Download size={17} />
          Export CSV
        </button>
      </section>
      <section className="summary-cards">
        <div>
          <span>Total events</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>Entries</span>
          <strong>{events.filter((e) => e.type === "ENTRY").length}</strong>
        </div>
        <div>
          <span>Exits</span>
          <strong>{events.filter((e) => e.type === "EXIT").length}</strong>
        </div>
        <div>
          <span>Latest event</span>
          <strong>
            {events[0]
              ? new Date(events[0].timestamp).toLocaleTimeString()
              : "—"}
          </strong>
          <small>{events[0]?.zone ?? "No events"}</small>
        </div>
      </section>
      <section className="panel">
        <div className="event-filters">
          <label className="search-control">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search camera, zone or tracking ID"
            />
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option>All events</option>
            <option>ENTRY</option>
            <option>EXIT</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="clickable-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Camera</th>
                <th>Zone</th>
                <th>Tracking ID</th>
                <th>Event</th>
                <th>Direction</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id} onClick={() => setSelected(e)}>
                  <td>{new Date(e.timestamp).toLocaleString()}</td>
                  <td>{e.camera}</td>
                  <td>{e.zone}</td>
                  <td className="mono">{e.trackingId}</td>
                  <td>
                    <span className={`event-type ${e.type.toLowerCase()}`}>
                      {e.type}
                    </span>
                  </td>
                  <td>{e.direction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="table-empty">
            No events match the current filters.
          </div>
        )}
        <footer className="pagination">
          <span>{filtered.length} events</span>
          <div>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={17} />
            </button>
            <strong>
              Page {page} of {pages}
            </strong>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </section>
      {selected && (
        <Modal
          title="Event details"
          subtitle="Anonymous tracking event"
          onClose={() => setSelected(null)}
        >
          <dl className="details-list">
            {Object.entries(selected).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}
