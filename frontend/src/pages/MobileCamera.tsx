import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Square } from "lucide-react";
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
      if (!clientId.current) clientId.current = crypto.randomUUID();
      const response = await api.post<{ sdp: string; type: RTCSdpType }>(`/phone-pairings/${sessionId}/offer`, { sdp: pc.localDescription?.sdp, type: "offer", client_id: clientId.current }, { headers: { Authorization: `Bearer ${token}` } });
      await pc.setRemoteDescription(response.data);
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
      if (stopped) return;
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
      } catch {
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
  return <main className="mobile-camera-page"><section className="mobile-camera-card"><div className="mobile-camera-brand"><Camera /><span>Department Occupancy</span></div><h1>Phone Camera</h1><p>Your video is encrypted in transit and processed for anonymous people counting. An active session has no automatic duration limit.</p><div className="mobile-local-preview"><video ref={video} autoPlay muted playsInline /><span>{status}</span></div>{visibleError && <p className="field-error">{visibleError}</p>}<div className="pairing-metrics"><span><strong>{duration(session?.streaming_duration_seconds)}</strong>Duration</span><span><strong>{(session?.capture_fps ?? 0).toFixed(1)}</strong>Capture FPS</span><span><strong>{(session?.processing_fps ?? 0).toFixed(1)}</strong>Processing FPS</span><span><strong>{(session?.latency_ms ?? 0).toFixed(1)} ms</strong>Latency</span></div><div className="mobile-camera-actions"><button className="button primary" disabled={!token || !session || streaming} onClick={() => void start()}><Camera size={18} />Start streaming</button><button className="button secondary" disabled={!streaming} onClick={() => void switchCamera()}><RefreshCw size={18} />Switch camera</button><button className="button secondary" disabled={!streaming} onClick={() => void stop()}><Square size={18} />Stop Camera</button></div><p className="secure-context-note">Camera access requires this page to use a trusted HTTPS certificate. Keep Safari in the foreground for reliable iPhone capture.</p></section></main>;
}
