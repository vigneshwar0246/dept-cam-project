import type { OccupancyState } from "../types";
export type OccupancyMessage = {
  type: "heartbeat" | "occupancy" | "correction";
  occupancy?: OccupancyState[];
  state?: OccupancyState;
  event?: unknown;
};
export function connectOccupancy(
  onMessage: (message: OccupancyMessage) => void,
  onStatus: (online: boolean) => void,
) {
  let socket: WebSocket | undefined;
  let timer = 0;
  let stopped = false;
  let attempt = 0;
  const connect = () => {
    socket = new WebSocket(
      `${import.meta.env.VITE_WS_URL ?? "ws://127.0.0.1:8000"}/ws/occupancy`,
    );
    socket.onopen = () => {
      attempt = 0;
      onStatus(true);
    };
    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data) as OccupancyMessage);
      } catch {
        /* ignore malformed server messages */
      }
    };
    socket.onclose = () => {
      onStatus(false);
      if (!stopped)
        timer = window.setTimeout(
          connect,
          Math.min(1000 * 2 ** attempt++, 30000),
        );
    };
    socket.onerror = () => socket?.close();
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
  };
}
