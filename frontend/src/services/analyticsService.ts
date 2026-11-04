import type { AnalyticsPoint } from "../types";
import { api } from "./api";
export const analyticsService = {
  daily: async () => (await api.get<AnalyticsPoint[]>("/analytics/daily")).data,
  hourly: async () =>
    (await api.get<AnalyticsPoint[]>("/analytics/hourly")).data,
  peaks: async () =>
    (await api.get<AnalyticsPoint[]>("/analytics/peak-hours")).data,
};
