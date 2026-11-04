import { useState, type FormEvent } from "react";
import type { Camera, CameraType, Zone } from "../../types";
import { Modal } from "../common/Modal";
import { cameraService } from "../../services/cameraService";
const types: CameraType[] = [
  "Laptop Webcam",
  "CCTV / RTSP Camera",
  "Mobile Camera",
];
export function CameraFormModal({
  camera,
  cameras,
  zones,
  onSave,
  onClose,
}: {
  camera?: Camera;
  cameras: Camera[];
  zones: Zone[];
  onSave: (camera: Camera) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Camera>(
    camera
      ? { ...camera, connectionDetails: "" }
      : {
          id: `CAM-${String(cameras.length + 1).padStart(3, "0")}`,
          name: "",
          type: "Laptop Webcam",
          zone: zones[0]?.id ?? "",
          location: "",
          connectionMethod: "",
          connectionDetails: "",
          status: "Offline",
          enabled: true,
          addedDate: "—",
          lastActive: "—",
          width: 1280,
          height: 720,
          fps: 15,
          captureFps: 0,
          lastFrameAgeMs: null,
          line: {
            start: { x: 0.1, y: 0.5 },
            end: { x: 0.9, y: 0.5 },
            enter_side: "positive",
            cooldown_seconds: 2,
            hysteresis: 0.01,
          },
        },
  );
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<number[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const discover = async () => {
    setDiscovering(true);
    setError("");
    try {
      setDevices(
        (await cameraService.discoverLocal()).map((item) => item.index),
      );
    } catch {
      setError(
        "Camera discovery failed. Check permissions and close other camera applications.",
      );
    } finally {
      setDiscovering(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.zone || (!camera && !form.connectionDetails)) {
      setError(
        "Name, zone and connection source are required for new cameras.",
      );
      return;
    }
    onSave(form);
  };
  return (
    <Modal
      title={camera ? "Edit camera" : "Add camera"}
      subtitle="Saved to the FastAPI backend and MongoDB."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Camera name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          {form.type === "Laptop Webcam" && (
            <div className="span-full">
              <button
                type="button"
                className="button secondary"
                onClick={() => void discover()}
              >
                {discovering ? "Scanning…" : "Discover laptop cameras"}
              </button>
              {devices.length > 0 && (
                <span className="privacy-note">
                  Available device indices: {devices.join(", ")}
                </span>
              )}
            </div>
          )}
          <label>
            Width
            <input
              type="number"
              min="160"
              value={form.width}
              onChange={(e) =>
                setForm({ ...form, width: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Height
            <input
              type="number"
              min="120"
              value={form.height}
              onChange={(e) =>
                setForm({ ...form, height: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Target FPS
            <input
              type="number"
              min="1"
              max="120"
              value={form.fps}
              onChange={(e) =>
                setForm({ ...form, fps: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Line start X
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.line.start.x}
              onChange={(e) =>
                setForm({
                  ...form,
                  line: {
                    ...form.line,
                    start: { ...form.line.start, x: Number(e.target.value) },
                  },
                })
              }
            />
          </label>
          <label>
            Line start Y
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.line.start.y}
              onChange={(e) =>
                setForm({
                  ...form,
                  line: {
                    ...form.line,
                    start: { ...form.line.start, y: Number(e.target.value) },
                  },
                })
              }
            />
          </label>
          <label>
            Line end X
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.line.end.x}
              onChange={(e) =>
                setForm({
                  ...form,
                  line: {
                    ...form.line,
                    end: { ...form.line.end, x: Number(e.target.value) },
                  },
                })
              }
            />
          </label>
          <label>
            Line end Y
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.line.end.y}
              onChange={(e) =>
                setForm({
                  ...form,
                  line: {
                    ...form.line,
                    end: { ...form.line.end, y: Number(e.target.value) },
                  },
                })
              }
            />
          </label>
          <label>
            Entry side
            <select
              value={form.line.enter_side}
              onChange={(e) =>
                setForm({
                  ...form,
                  line: {
                    ...form.line,
                    enter_side: e.target.value as "positive" | "negative",
                  },
                })
              }
            >
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
            </select>
          </label>
          <label>
            Cooldown seconds
            <input
              type="number"
              min="0"
              max="60"
              step="0.1"
              value={form.line.cooldown_seconds}
              onChange={(e) =>
                setForm({
                  ...form,
                  line: {
                    ...form.line,
                    cooldown_seconds: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Hysteresis
            <input
              type="number"
              min="0"
              max="0.25"
              step="0.005"
              value={form.line.hysteresis}
              onChange={(e) =>
                setForm({
                  ...form,
                  line: { ...form.line, hysteresis: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            Camera ID
            <input
              value={form.id}
              disabled={Boolean(camera)}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
          </label>
          <label>
            Camera type
            <select
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as CameraType,
                  connectionDetails: "",
                })
              }
            >
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Zone
            <input
              list="zones"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
            />
            <datalist id="zones">
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id} />
              ))}
            </datalist>
          </label>
          <label className="span-full">
            {form.type === "Laptop Webcam" ? "Device index" : "Stream URL"}
            <input
              type={form.type === "Laptop Webcam" ? "number" : "password"}
              value={
                form.connectionDetails === "Stored securely"
                  ? ""
                  : form.connectionDetails
              }
              onChange={(e) =>
                setForm({ ...form, connectionDetails: e.target.value })
              }
              autoComplete="off"
            />
          </label>
        </div>
        {error && <p className="field-error">{error}</p>}
        <p className="privacy-note">
          Camera credentials are sent directly to the backend and are not stored
          by the browser. Leave the source blank while editing to keep the
          existing value.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save camera</button>
        </div>
      </form>
    </Modal>
  );
}
