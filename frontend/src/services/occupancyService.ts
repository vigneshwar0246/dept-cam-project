import type { OccupancyState } from "../types";
import { api } from "./api";
export const occupancyService = {
  list: async () => (await api.get<OccupancyState[]>("/occupancy")).data,
  history: async () =>
    (
      await api.get<OccupancyState[]>("/occupancy/history", {
        params: { page_size: 200 },
      })
    ).data,
  correct: async (zone: string, occupancy: number, reason: string) =>
    (
      await api.post<OccupancyState>(`/occupancy/${zone}/correction`, {
        occupancy,
        reason,
      })
    ).data,
};
