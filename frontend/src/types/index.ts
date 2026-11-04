export type PageKey =
  "overview" | "monitoring" | "cameras" | "events" | "analytics" | "settings";
export type CameraStatus = "Online" | "Offline" | "Connecting";
export type CameraType =
  "Laptop Webcam" | "CCTV / RTSP Camera" | "Mobile Camera";
export interface LineConfig {
  start: { x: number; y: number };
  end: { x: number; y: number };
  enter_side: "positive" | "negative";
  cooldown_seconds: number;
  hysteresis: number;
}

export interface Camera {
  id: string;
  name: string;
  type: CameraType;
  zone: string;
  location: string;
  connectionMethod: string;
  connectionDetails: string;
  status: CameraStatus;
  enabled: boolean;
  addedDate: string;
  lastActive: string;
  width: number;
  height: number;
  fps: number;
  captureFps: number;
  lastFrameAgeMs: number | null;
  streamingDurationSeconds?: number;
  line: LineConfig;
}

export interface Zone {
  id: string;
  name: string;
  occupancy: number;
  capacity: number;
}

export interface OccupancyEvent {
  id: string;
  timestamp: string;
  camera: string;
  zone: string;
  trackingId: string;
  type: "ENTRY" | "EXIT";
  direction: string;
  status: "Verified" | "Pending";
}

export interface OccupancyState {
  zone_id: string;
  occupancy: number;
  entries: number;
  exits: number;
  updated_at: string;
}
export interface BackendCamera {
  id: string;
  name: string;
  type: "laptop" | "mobile" | "rtsp";
  zone_id: string;
  source: string | number;
  width: number;
  height: number;
  fps: number;
  enabled: boolean;
  line: LineConfig;
  status: string;
  error: string | null;
  processing_status: "idle" | "waiting_for_frame" | "active" | "error";
  processing_error: string | null;
  capture_fps: number;
  last_frame_age_ms: number | null;
  has_frame: boolean;
  streaming_duration_seconds?: number;
  streaming_started_at?: string | null;
  last_received_at?: string | null;
}
export interface AnalyticsPoint {
  period: string;
  entries: number;
  exits: number;
}
export interface SystemStatus {
  model: { loaded?: boolean; device?: string; error?: string } | string;
  cuda_available: boolean;
  cameras: number;
  database: boolean;
}
export interface Performance {
  cameras: Record<
    string,
    {
      processing_fps: number;
      average_inference_ms: number;
      average_total_latency_ms: number;
      people_detected: number;
      frames_processed: number;
    }
  >;
  gpu: { name: string; allocated_mb: number; reserved_mb: number } | null;
  persistence_queue: number;
}
