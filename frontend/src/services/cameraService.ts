import type { BackendCamera, LineConfig } from "../types";
import { api } from "./api";

export interface CameraPayload {
  id: string;
  name: string;
  type: "laptop" | "mobile" | "rtsp";
  zone_id: string;
  source: string | number;
  width?: number;
  height?: number;
  fps?: number;
  enabled?: boolean;
  line?: LineConfig;
}
export interface PairingSession {
  id: string;
  camera_id: string;
  status: string;
  expires_at: string;
  first_frame_at: string | null;
  claimed_at?: string | null;
  streaming_duration_seconds?: number;
  capture_fps?: number;
  processing_fps?: number;
  latency_ms?: number;
  pairing_url?: string;
  ice_servers?: RTCIceServer[];
}
export const cameraService = {
  list: async () => (await api.get<BackendCamera[]>("/cameras")).data,
  create: async (payload: CameraPayload) =>
    (await api.post<BackendCamera>("/cameras", payload)).data,
  update: async (id: string, payload: Partial<CameraPayload>) =>
    (await api.put<BackendCamera>(`/cameras/${id}`, payload)).data,
  remove: async (id: string) => {
    await api.delete(`/cameras/${id}`);
  },
  start: async (id: string) => {
    await api.post(`/cameras/${id}/start`);
  },
  stop: async (id: string) => {
    await api.post(`/cameras/${id}/stop`);
  },
  discoverLocal: async () =>
    (
      await api.get<
        { index: number; width: number; height: number; fps: number }[]
      >("/cameras/discover/local")
    ).data,
  streamUrl: (id: string) =>
    `${api.defaults.baseURL}/cameras/${encodeURIComponent(id)}/stream`,
  snapshotUrl: (id: string) =>
    `${api.defaults.baseURL}/cameras/${encodeURIComponent(id)}/snapshot`,
  createPairing: async (payload: {
    camera_id: string;
    camera_name: string;
    zone_id: string;
  }) => (await api.post<PairingSession>("/phone-pairings", payload)).data,
  pairingStatus: async (id: string, token: string) =>
    (
      await api.get<PairingSession>(`/phone-pairings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).data,
  cancelPairing: async (id: string) => {
    await api.post(`/phone-pairings/${id}/cancel`);
  },
};
