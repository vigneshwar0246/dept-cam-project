import { Camera as CameraIcon, Grid2X2, LayoutGrid, Rows3 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Camera, Performance } from "../types";
import { StatusBadge } from "../components/common/StatusBadge";
import { cameraService } from "../services/cameraService";
function Preview({ camera }: { camera: Camera }) {
  const [failed, setFailed] = useState(false);
  const url =
    camera.status === "Online" ? cameraService.streamUrl(camera.id) : "";
  return (
    <div className="camera-preview">
      {url && !failed ? (
        <img
          src={url}
          alt={`Latest frame from ${camera.name}`}
          onError={() => setFailed(true)}
          onLoad={() => setFailed(false)}
        />
      ) : (
        <>
          <CameraIcon size={38} />
          <strong>
            {camera.status === "Online"
              ? failed
                ? "No frame available"
                : "Loading latest frame…"
              : "Camera is not running"}
          </strong>
        </>
      )}
      <div className="preview-status">
        <StatusBadge value={camera.status} />
      </div>
    </div>
  );
}
export function LiveMonitoring({
  cameras,
  performance,
}: {
  cameras: Camera[];
  performance: Performance | null;
}) {
  const [filter, setFilter] = useState("All Cameras");
  const [columns, setColumns] = useState(3);
  const filtered = useMemo(
    () =>
      filter === "All Cameras"
        ? cameras
        : cameras.filter((c) => c.status === filter),
    [cameras, filter],
  );
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <div className="eyebrow">CONTROLLED SNAPSHOT REFRESH</div>
          <h2>Live Monitoring</h2>
          <p>
            Latest backend frames refresh every three seconds for running
            cameras.
          </p>
        </div>
      </section>
      <section className="toolbar">
        <div className="filter-tabs">
          {["All Cameras", "Online", "Offline", "Connecting"].map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="layout-switch">
          <button onClick={() => setColumns(2)}>
            <Grid2X2 />
          </button>
          <button onClick={() => setColumns(3)}>
            <Rows3 />
          </button>
          <button onClick={() => setColumns(4)}>
            <LayoutGrid />
          </button>
        </div>
      </section>
      <section className={`camera-grid columns-${columns}`}>
        {filtered.map((camera) => (
          <article className="camera-card" key={camera.id}>
            <Preview camera={camera} />
            <div className="camera-card-body">
              <div>
                <h3>{camera.name}</h3>
                <p>{camera.zone}</p>
              </div>
            </div>
            <footer>
              <span>
                {camera.captureFps.toFixed(1)} capture FPS ·{" "}
                {(performance?.cameras[camera.id]?.processing_fps ?? 0).toFixed(
                  1,
                )}{" "}
                processing FPS
              </span>
              <span>
                {(
                  performance?.cameras[camera.id]?.average_total_latency_ms ?? 0
                ).toFixed(1)}{" "}
                ms total · {camera.lastActive}
              </span>
            </footer>
          </article>
        ))}
      </section>
      {!filtered.length && (
        <div className="empty-state">
          <h3>No cameras available</h3>
        </div>
      )}
    </div>
  );
}
