import asyncio
from collections import defaultdict

from fastapi import WebSocket


class WebSocketHub:
    def __init__(self) -> None:
        self.occupancy: set[WebSocket] = set()
        self.cameras: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, camera_id: str | None = None) -> None:
        await websocket.accept()
        (self.cameras[camera_id] if camera_id else self.occupancy).add(websocket)

    def disconnect(self, websocket: WebSocket, camera_id: str | None = None) -> None:
        (self.cameras[camera_id] if camera_id else self.occupancy).discard(websocket)

    async def broadcast(self, payload: dict, camera_id: str | None = None) -> None:
        clients = list(self.cameras[camera_id] if camera_id else self.occupancy)
        results = await asyncio.gather(*(client.send_json(payload) for client in clients), return_exceptions=True)
        for client, result in zip(clients, results):
            if isinstance(result, Exception):
                self.disconnect(client, camera_id)

