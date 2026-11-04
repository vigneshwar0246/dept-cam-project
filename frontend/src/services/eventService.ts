import type { OccupancyEvent } from "../types";
import { api } from "./api";
interface BackendEvent {
  zone_id: string;
  camera_id: string;
  event_type: "enter" | "exit";
  track_id: string;
  timestamp: string;
}
export function mapEvent(row: BackendEvent, index = 0): OccupancyEvent {
  return {
    id: `${row.camera_id}-${row.timestamp}-${index}`,
    timestamp: row.timestamp,
    camera: row.camera_id,
    zone: row.zone_id,
    trackingId: row.track_id,
    type: row.event_type === "enter" ? "ENTRY" : "EXIT",
    direction:
      row.event_type === "enter" ? "Outside → Inside" : "Inside → Outside",
    status: "Verified",
  };
}
export const eventService = {
  list: async (zone?: string) =>
    (
      await api.get<BackendEvent[]>("/events", {
        params: { zone_id: zone || undefined, page_size: 200 },
      })
    ).data.map(mapEvent),
};
