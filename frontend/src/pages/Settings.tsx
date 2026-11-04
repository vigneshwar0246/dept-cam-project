import type { Performance, SystemStatus, Zone } from "../types";
export function Settings({
  zones,
  status,
  performance,
  database,
}: {
  zones: Zone[];
  status: SystemStatus | null;
  performance: Performance | null;
  database: string;
}) {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <h2>Settings</h2>
          <p>Backend status and browser-local display preferences.</p>
        </div>
      </section>
      <section className="settings-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>System status</h3>
              <p>Reported by FastAPI</p>
            </div>
          </div>
          <dl className="app-info">
            <div>
              <dt>Backend</dt>
              <dd>{status ? "Connected" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>MongoDB</dt>
              <dd>{database}</dd>
            </div>
            <div>
              <dt>CUDA</dt>
              <dd>{status?.cuda_available ? "Available" : "Not available"}</dd>
            </div>
            <div>
              <dt>GPU</dt>
              <dd>{performance?.gpu?.name ?? "None reported"}</dd>
            </div>
            <div>
              <dt>Persistence queue</dt>
              <dd>{performance?.persistence_queue ?? "—"}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Display capacities</h3>
              <p>Stored only in this browser; no zone CRUD API exists.</p>
            </div>
          </div>
          <div className="settings-form">
            {zones.map((zone) => (
              <label key={zone.id}>
                {zone.name}
                <input
                  type="number"
                  min="1"
                  defaultValue={zone.capacity}
                  onBlur={(event) =>
                    localStorage.setItem(
                      `dot-capacity-${zone.id}`,
                      event.target.value,
                    )
                  }
                />
              </label>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
