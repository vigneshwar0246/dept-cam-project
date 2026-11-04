import { useCallback, useEffect, useState } from "react";
import type {
  AnalyticsPoint,
  BackendCamera,
  Camera,
  OccupancyEvent,
  OccupancyState,
  Performance,
  SystemStatus,
  Zone,
} from "../types";
import { analyticsService } from "../services/analyticsService";
import { cameraService } from "../services/cameraService";
import { eventService } from "../services/eventService";
import { occupancyService } from "../services/occupancyService";
import { messageFromError } from "../services/api";
import { systemService } from "../services/systemService";
import { connectOccupancy } from "../services/websocketService";

const labelStatus = (status: string): Camera["status"] =>
  status === "running"
    ? "Online"
    : ["connecting", "reconnecting"].includes(status)
      ? "Connecting"
      : "Offline";
export const mapCamera = (row: BackendCamera): Camera => ({
  id: row.id,
  name: row.name,
  type:
    row.type === "laptop"
      ? "Laptop Webcam"
      : row.type === "rtsp"
        ? "CCTV / RTSP Camera"
        : "Mobile Camera",
  zone: row.zone_id,
  location: row.processing_error ?? row.error ?? "Configured camera source",
  connectionMethod:
    row.type === "laptop"
      ? "Webcam device"
      : row.type === "rtsp"
        ? "RTSP stream"
        : "Mobile stream",
  connectionDetails: String(row.source),
  status: row.status === "running" && row.processing_status !== "active" ? (row.processing_status === "error" ? "Offline" : "Connecting") : labelStatus(row.status),
  enabled: row.enabled,
  addedDate: "—",
  lastActive:
    row.last_frame_age_ms == null
      ? "No frame"
      : `${Math.round(row.last_frame_age_ms)} ms ago`,
  width: row.width,
  height: row.height,
  fps: row.fps,
  captureFps: row.capture_fps,
  lastFrameAgeMs: row.last_frame_age_ms,
  streamingDurationSeconds: row.streaming_duration_seconds ?? 0,
  line: row.line,
});

export function useDashboardData(active: boolean) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyState[]>([]);
  const [events, setEvents] = useState<OccupancyEvent[]>([]);
  const [daily, setDaily] = useState<AnalyticsPoint[]>([]);
  const [hourly, setHourly] = useState<AnalyticsPoint[]>([]);
  const [peaks, setPeaks] = useState<AnalyticsPoint[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [database, setDatabase] = useState("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketOnline, setSocketOnline] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        cameraRows,
        occupancyRows,
        eventRows,
        dailyRows,
        hourlyRows,
        peakRows,
        system,
        perf,
        health,
      ] = await Promise.all([
        cameraService.list(),
        occupancyService.list(),
        eventService.list(),
        analyticsService.daily(),
        analyticsService.hourly(),
        analyticsService.peaks(),
        systemService.status(),
        systemService.performance(),
        systemService.health(),
      ]);
      setCameras(cameraRows.map(mapCamera));
      setOccupancy(occupancyRows);
      setEvents(eventRows);
      setDaily(dailyRows);
      setHourly(hourlyRows);
      setPeaks(peakRows);
      setStatus(system);
      setPerformance(perf);
      setDatabase(health.database);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);
  const refreshRuntime = useCallback(async () => {
    try {
      const [cameraRows, perf] = await Promise.all([
        cameraService.list(),
        systemService.performance(),
      ]);
      setCameras(cameraRows.map(mapCamera));
      setPerformance(perf);
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }, []);
  useEffect(() => {
    if (!active) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const disconnect = connectOccupancy((message) => {
      const rows = message.occupancy ?? (message.state ? [message.state] : []);
      if (rows.length)
        setOccupancy((current) => {
          const next = new Map(current.map((row) => [row.zone_id, row]));
          rows.forEach((row) => next.set(row.zone_id, row));
          return [...next.values()];
        });
      if (message.type === "occupancy")
        void eventService.list().then(setEvents);
    }, setSocketOnline);
    return () => {
      clearTimeout(initial);
      disconnect();
    };
  }, [active, refresh]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void refreshRuntime(), 2000);
    return () => clearInterval(timer);
  }, [active, refreshRuntime]);
  const zoneIds = new Set([
    ...cameras.map((camera) => camera.zone),
    ...occupancy.map((row) => row.zone_id),
  ]);
  const zones: Zone[] = [...zoneIds].map((id) => {
    const state = occupancy.find((row) => row.zone_id === id);
    const capacity = Number(localStorage.getItem(`dot-capacity-${id}`)) || 100;
    return { id, name: id, occupancy: state?.occupancy ?? 0, capacity };
  });
  return {
    cameras,
    setCameras,
    occupancy,
    zones,
    events,
    daily,
    hourly,
    peaks,
    status,
    performance,
    database,
    loading,
    error,
    socketOnline,
    refresh,
  };
}
