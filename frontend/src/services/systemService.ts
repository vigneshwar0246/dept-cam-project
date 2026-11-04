import type { Performance, SystemStatus } from "../types";
import { api, setAdminKey } from "./api";
export const systemService = {
  health: async () =>
    (await api.get<{ status: string; database: string }>("/health")).data,
  status: async () => (await api.get<SystemStatus>("/system/status")).data,
  performance: async () =>
    (await api.get<Performance>("/system/performance")).data,
  verifyAdmin: async (key: string) => {
    setAdminKey(key);
    try {
      await api.get("/admin/verify");
    } catch (error) {
      setAdminKey("");
      throw error;
    }
  },
};
