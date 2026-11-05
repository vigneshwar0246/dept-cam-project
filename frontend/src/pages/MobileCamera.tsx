import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, RefreshCw, ShieldCheck, Square, Wifi } from "lucide-react";
import { api, messageFromError } from "../services/api";
import type { PairingSession } from "../services/cameraService";

const waitForIce = (peer: RTCPeerConnection) => new Promise<void>((resolve) => {
  if (peer.iceGatheringState === "complete") return resolve();
  const handler = () => {
    if (peer.iceGatheringState === "complete") {
      peer.removeEventListener("icegatheringstatechange", handler);
      resolve();
    }
  };
  peer.addEventListener("icegatheringstatechange", handler);
});

const duration = (seconds = 0) => `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds % 3600 / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export function MobileCamera() {
  const sessionId = location.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const token = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | undefined>(undefined);
  const peer = useRef<RTCPeerConnection | undefined>(undefined);
  const clientId = useRef("");
  const reconnectTimer = useRef(0);
  const reconnectAttempt = useRef(0);
  const negotiating = useRef(false);
  const manuallyStopped = useRef(false);
  const [session, setSession] = useState<PairingSession>();
  const [status, setStatus] = useState("QR code ready");
  const [error, setError] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [streaming, setStreaming] = useState(false);

  const closePeer = useCallback(() => {
    const current = peer.current;
    peer.current = undefined;
    current?.close();
  }, []);

  const negotiate = useCallback(async function connectPeer(media: MediaStream) {
    if (manuallyStopped.current || negotiating.current) return;
    negotiating.current = true;
    window.clearTimeout(reconnectTimer.current);
    closePeer();
    setStatus(reconnectAttempt.current ? "Reconnecting" : "Establishing WebRTC");
    try {
      const pc = new RTCPeerConnection({ iceServers: session?.ice_servers ?? [] });
      peer.current = pc;
      media.getVideoTracks().forEach((track) => pc.addTrack(track, media));
      pc.onconnectionstatechange = () => {
        if (peer.current !== pc) return;
        if (pc.connectionState === "connected") {
          reconnectAttempt.current = 0;
          setStatus("WebRTC connected — waiting for backend video");
        } else if (["disconnected", "failed"].includes(pc.connectionState) && !manuallyStopped.current) {
          setStatus("Connection interrupted — reconnecting");
          const delay = Math.min(1000 * 2 ** reconnectAttempt.current++, 30000);
          window.clearTimeout(reconnectTimer.current);
          reconnectTimer.current = window.setTimeout(() => void connectPeer(media), delay);
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIce(pc);
      if (!clientId.current) {
        const key = `phone-camera-client-${sessionId}`;
        clientId.current = sessionStorage.getItem(key) ?? crypto.randomUUID();
        sessionStorage.setItem(key, clientId.current);
      }
      const response = await api.post<{ sdp: string; type: RTCSdpType }>(`/phone-pairings/${sessionId}/offer`, { sdp: pc.localDescription?.sdp, type: "offer", client_id: clientId.current }, { headers: { Authorization: `Bearer ${token}` } });
      await pc.setRemoteDescription(response.data);
      setError("");
    } catch (cause) {
      setError(messageFromError(cause));
      if (!manuallyStopped.current) {
        setStatus("Connection interrupted — reconnecting");
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current++, 30000);
        window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = window.setTimeout(() => void connectPeer(media), delay);
      }
    } finally {
      negotiating.current = false;
    }
  }, [closePeer, session?.ice_servers, sessionId, token]);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const refresh = () => void api.get<PairingSession>(`/phone-pairings/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => {
      if (stopped || manuallyStopped.current) return;
      setSession(response.data);
      if (response.data.status === "camera_connected") setStatus("Camera connected — backend is receiving video");
      else if (response.data.status === "reconnecting") setStatus("Connection interrupted — reconnecting");
      else if (response.data.status === "permanently_closed") setStatus("Connection closed");
      else if (!stream.current) setStatus("Ready for camera permission");
    }).catch((cause) => { if (!stopped) setError(messageFromError(cause)); });
    refresh();
    const poll = window.setInterval(refresh, 1000);
    return () => { stopped = true; window.clearInterval(poll); };
  }, [sessionId, token]);

  useEffect(() => {
    const reconnect = () => { if (stream.current && !manuallyStopped.current) void negotiate(stream.current); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [negotiate]);

  useEffect(() => () => {
    window.clearTimeout(reconnectTimer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    closePeer();
  }, [closePeer]);

  const stop = async () => {
    manuallyStopped.current = true;
    window.clearTimeout(reconnectTimer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    closePeer();
    await api.post(`/phone-pairings/${sessionId}/disconnect`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    setStreaming(false);
    setStatus("Disconnected");
  };

  const start = async (nextFacing = facing) => {
    manuallyStopped.current = false;
    reconnectAttempt.current = 0;
    setError("");
    setStatus("Waiting for camera permission");
    try {
      stream.current?.getTracks().forEach((track) => track.stop());
      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 30 } } });
      } catch (cause) {
        if (!(cause instanceof DOMException) || cause.name !== "OverconstrainedError") throw cause;
        media = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      stream.current = media;
      if (video.current) video.current.srcObject = media;
      setStreaming(true);
      await negotiate(media);
    } catch (cause) {
      setStatus("Camera permission failed");
      setError(messageFromError(cause));
    }
  };

  const switchCamera = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    await start(next);
  };

  const visibleError = !token ? "This pairing link is missing its one-time token." : error;
  const backendReceiving = session?.status === "camera_connected";
  return <main className="mobile-camera-page"><section className="mobile-camera-card"><header className="mobile-camera-header"><div className="mobile-camera-brand"><span><Camera size={19} /></span><div><strong>Department Occupancy</strong><small>Secure phone camera</small></div></div><div className={`mobile-connection-badge ${backendReceiving ? "connected" : ""}`}><span />{backendReceiving ? "Live" : streaming ? "Connecting" : "Ready"}</div></header><div className="mobile-camera-intro"><p className="mobile-kicker">Private WebRTC connection</p><h1>Use this phone as a camera</h1><p>Keep this page open while streaming. Video is processed for anonymous occupancy counting and is not recorded by default.</p></div><div className={`mobile-local-preview ${streaming ? "is-streaming" : ""}`}><video ref={video} autoPlay muted playsInline />{!streaming && <div className="mobile-preview-empty"><Camera size={34} /><strong>Camera preview</strong><span>Tap Start camera below</span></div>}<div className="mobile-preview-status"><span className={backendReceiving ? "live" : ""} />{status}</div></div>{visibleError && <div className="mobile-error" role="alert"><strong>Connection problem</strong><span>{visibleError}</span></div>}<div className="mobile-steps"><div className={session ? "done" : "active"}><span>{session ? <Check size={15} /> : "1"}</span><p><strong>Pairing link</strong><small>{session ? "Verified" : "Checking"}</small></p></div><div className={streaming ? "done" : session ? "active" : ""}><span>{streaming ? <Check size={15} /> : "2"}</span><p><strong>Camera access</strong><small>{streaming ? "Granted" : "Permission required"}</small></p></div><div className={backendReceiving ? "done" : streaming ? "active" : ""}><span>{backendReceiving ? <Check size={15} /> : "3"}</span><p><strong>Backend video</strong><small>{backendReceiving ? "Receiving frames" : "Waiting"}</small></p></div></div><div className="pairing-metrics mobile-metrics"><span><strong>{duration(session?.streaming_duration_seconds)}</strong>Duration</span><span><strong>{(session?.capture_fps ?? 0).toFixed(1)}</strong>Capture FPS</span><span><strong>{(session?.processing_fps ?? 0).toFixed(1)}</strong>AI FPS</span><span><strong>{(session?.latency_ms ?? 0).toFixed(0)} ms</strong>Latency</span></div><div className="mobile-camera-actions">{!streaming ? <button className="mobile-primary-action" disabled={!token || !session} onClick={() => void start()}><Camera size={20} />Start camera</button> : <><button className="mobile-secondary-action" onClick={() => void switchCamera()}><RefreshCw size={18} />Switch</button><button className="mobile-stop-action" onClick={() => void stop()}><Square size={18} />Stop Camera</button></>}</div><footer className="mobile-security-note"><ShieldCheck size={16} /><span>Encrypted connection</span><Wifi size={16} /><span>Keep Wi-Fi connected</span></footer></section></main>;
}
