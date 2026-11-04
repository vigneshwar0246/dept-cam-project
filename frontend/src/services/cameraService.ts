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
};
