import { useEffect, useRef, useState } from "react";
import { Smartphone, X } from "lucide-react";
import QRCode from "qrcode";
import type { Zone } from "../../types";
import { cameraService, type PairingSession } from "../../services/cameraService";
import { messageFromError } from "../../services/api";
import { Modal } from "../common/Modal";

const labels: Record<string, string> = {
  waiting_for_phone: "Waiting for phone",
  establishing_webrtc: "Establishing WebRTC",
  receiving_video: "Receiving video",
  camera_connected: "Camera connected",
  connection_interrupted: "Connection interrupted",
  expired: "Pairing expired",
  cancelled: "Cancelled",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting",
  permanently_closed: "Connection closed",
};

export function PhonePairingModal({ zones, onClose, onConnected }: { zones: Zone[]; onClose: () => void; onConnected: () => Promise<void> }) {
  const [name, setName] = useState("Phone Camera");
  const [cameraId, setCameraId] = useState("phone-camera");
  const [zone, setZone] = useState(zones[0]?.id ?? "main");
  const [session, setSession] = useState<PairingSession>();
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const connectedNotified = useRef(false);
  const token = session?.pairing_url ? new URL(session.pairing_url).hash.replace("#token=", "") : "";
  const remaining = session ? Math.max(0, Math.ceil((new Date(session.expires_at).getTime() - now) / 1000)) : 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!session?.pairing_url) return;
    void QRCode.toDataURL(session.pairing_url, { width: 260, margin: 2, errorCorrectionLevel: "M" }).then(setQr);
  }, [session?.pairing_url]);
  useEffect(() => {
    if (!session || !token || ["expired", "cancelled", "disconnected", "permanently_closed"].includes(session.status)) return;
    const timer = window.setInterval(() => {
      void cameraService.pairingStatus(session.id, token).then((next) => {
        setSession((current) => ({ ...next, pairing_url: current?.pairing_url }));
        if (next.status === "camera_connected" && !connectedNotified.current) {
          connectedNotified.current = true;
          void onConnected();
        }
      }).catch((e) => setError(messageFromError(e)));
    }, 1000);
    return () => clearInterval(timer);
  }, [session, token, onConnected]);

  const create = async () => {
    setError("");
    try {
      setSession(await cameraService.createPairing({ camera_id: cameraId.trim(), camera_name: name.trim(), zone_id: zone.trim() }));
    } catch (e) { setError(messageFromError(e)); }
  };
  const cancel = async () => {
    if (session) await cameraService.cancelPairing(session.id).catch(() => undefined);
    onClose();
  };
  return (
    <Modal title="Connect Phone Camera" onClose={() => void cancel()}>
      <div className="phone-pairing">
        {!session ? <>
          <p>Register the phone camera, then scan its one-time QR code.</p>
          <div className="form-grid">
            <label>Camera name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Camera ID<input value={cameraId} onChange={(e) => setCameraId(e.target.value)} pattern="[A-Za-z0-9_-]+" /></label>
            <label className="span-full">Zone<input list="phone-zones" value={zone} onChange={(e) => setZone(e.target.value)} /><datalist id="phone-zones">{zones.map((item) => <option key={item.id} value={item.id} />)}</datalist></label>
          </div>
          <button className="button primary" disabled={!name.trim() || !cameraId.trim() || !zone.trim()} onClick={() => void create()}><Smartphone size={17} />Create pairing session</button>
        </> : <>
          <div className="pairing-status"><span className={`pairing-dot ${session.status}`} />{labels[session.status] ?? session.status}<strong>{session.claimed_at ? "No session time limit" : `${remaining}s to pair`}</strong></div>
          {qr && remaining > 0 && !session.claimed_at && <img className="pairing-qr" src={qr} alt="One-time phone camera pairing QR code" />}
          <ol className="pairing-instructions"><li>Connect the phone and laptop to the same trusted Wi-Fi.</li><li>Scan this QR code using the phone camera.</li><li>Tap Start streaming and allow camera access.</li></ol>
          {session.status === "camera_connected" && <div className="pairing-preview"><img src={cameraService.streamUrl(session.camera_id)} alt="Processed phone camera feed" /></div>}
          {session.claimed_at && <div className="pairing-metrics"><span><strong>{Math.floor((session.streaming_duration_seconds ?? 0) / 3600).toString().padStart(2, "0")}:{Math.floor((session.streaming_duration_seconds ?? 0) % 3600 / 60).toString().padStart(2, "0")}:{Math.floor((session.streaming_duration_seconds ?? 0) % 60).toString().padStart(2, "0")}</strong>Duration</span><span><strong>{(session.capture_fps ?? 0).toFixed(1)}</strong>Capture FPS</span><span><strong>{(session.processing_fps ?? 0).toFixed(1)}</strong>Processing FPS</span><span><strong>{(session.latency_ms ?? 0).toFixed(1)} ms</strong>Latency</span></div>}
          <div className="modal-actions"><button className="button secondary" onClick={() => void cancel()}><X size={16} />{session.claimed_at ? "Stop Camera" : "Cancel pairing"}</button>{["expired", "permanently_closed", "disconnected"].includes(session.status) && <button className="button primary" onClick={() => { connectedNotified.current = false; setSession(undefined); setQr(""); }}>Create new pairing</button>}</div>
        </>}
        {error && <p className="field-error">{error}</p>}
      </div>
    </Modal>
  );
}
