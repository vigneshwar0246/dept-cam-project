import {
  Camera as CameraIcon,
  Edit3,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Camera, Performance, Zone } from "../types";
import { CameraFormModal } from "../components/cameras/CameraFormModal";
import { StatusBadge } from "../components/common/StatusBadge";
import { cameraService } from "../services/cameraService";
import { messageFromError } from "../services/api";
export function CameraManagement({
  cameras,
  zones,
  onRefresh,
  performance,
}: {
  cameras: Camera[];
  zones: Zone[];
  onRefresh: () => Promise<void>;
  performance: Performance | null;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Camera | null | undefined>();
  const [error, setError] = useState("");
  const filtered = useMemo(
    () =>
      cameras.filter((c) =>
        `${c.name} ${c.id} ${c.zone}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [cameras, query],
  );
  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
      await onRefresh();
    } catch (e) {
      setError(messageFromError(e));
    }
  };
  const save = (camera: Camera) =>
    void run(async () => {
      const type =
        camera.type === "Laptop Webcam"
          ? "laptop"
          : camera.type === "CCTV / RTSP Camera"
            ? "rtsp"
            : "mobile";
      const source =
        type === "laptop"
          ? Number(camera.connectionDetails)
          : camera.connectionDetails;
      if (editing)
        await cameraService.update(camera.id, {
          name: camera.name,
          zone_id: camera.zone,
          ...(camera.connectionDetails ? { source } : {}),
          enabled: camera.enabled,
          width: camera.width,
          height: camera.height,
          fps: camera.fps,
          line: camera.line,
        });
      else
        await cameraService.create({
          id: camera.id,
          name: camera.name,
          type,
          zone_id: camera.zone,
          source,
          enabled: true,
          width: camera.width,
          height: camera.height,
          fps: camera.fps,
          line: camera.line,
        });
      setEditing(undefined);
    });
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <h2>Camera Management</h2>
          <p>Camera configurations persisted by the backend.</p>
        </div>
        <button className="button primary" onClick={() => setEditing(null)}>
          <Plus size={17} />
          Add Camera
        </button>
      </section>
      {error && <div className="demo-warning">{error}</div>}
      <section className="panel">
        <div className="table-toolbar">
          <label className="search-control">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cameras"
            />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Camera</th>
                <th>Type</th>
                <th>Zone</th>
                <th>Source</th>
                <th>Status</th>
                <th>Performance</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((camera) => (
                <tr key={camera.id}>
                  <td>
                    <div className="table-identity">
                      <span>
                        <CameraIcon size={17} />
                      </span>
                      <div>
                        <strong>{camera.name}</strong>
                        <small>{camera.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{camera.type}</td>
                  <td>{camera.zone}</td>
                  <td>{camera.connectionDetails}</td>
                  <td>
                    <StatusBadge value={camera.status} />
                  </td>
                  <td>
                    {camera.captureFps.toFixed(1)} capture FPS
                    <small className="cell-subtitle">
                      {(
                        performance?.cameras[camera.id]?.average_inference_ms ??
                        0
                      ).toFixed(1)}{" "}
                      ms inference ·{" "}
                      {(
                        performance?.cameras[camera.id]
                          ?.average_total_latency_ms ?? 0
                      ).toFixed(1)}{" "}
                      ms total
                    </small>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        title="Start"
                        onClick={() =>
                          void run(() => cameraService.start(camera.id))
                        }
                      >
                        <Play size={17} />
                      </button>
                      <button
                        title="Stop"
                        onClick={() =>
                          void run(() => cameraService.stop(camera.id))
                        }
                      >
                        <Square size={17} />
                      </button>
                      <button title="Edit" onClick={() => setEditing(camera)}>
                        <Edit3 size={17} />
                      </button>
                      <button
                        title="Delete"
                        onClick={() =>
                          confirm(`Delete ${camera.name}?`) &&
                          void run(() => cameraService.remove(camera.id))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="table-empty">No cameras are configured.</div>
        )}
      </section>
      {editing !== undefined && (
        <CameraFormModal
          camera={editing ?? undefined}
          cameras={cameras}
          zones={zones}
          onSave={save}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
