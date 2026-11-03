from datetime import UTC, datetime
from time import monotonic

from backend.api.websocket import WebSocketHub
from backend.counting.occupancy_manager import OccupancyManager
from backend.database.repository import Repository


class OccupancyService:
    def __init__(self, manager: OccupancyManager, repository: Repository, hub: WebSocketHub) -> None:
        self.manager, self.repository, self.hub = manager, repository, hub
        self._duplicates: dict[tuple[str, str], float] = {}

    async def event(self, zone_id: str, camera_id: str, event_type: str, track_id: int, duplicate_group: str | None = None) -> dict | None:
        now = monotonic()
        if duplicate_group:
            key = (duplicate_group, event_type)
            if now - self._duplicates.get(key, float("-inf")) < 2:
                return None
            self._duplicates[key] = now
        state = self.manager.apply(zone_id, event_type)
        event = {"zone_id": zone_id, "camera_id": camera_id, "event_type": event_type, "track_id": str(track_id), "timestamp": datetime.now(UTC)}
        self.repository.enqueue("occupancy_events", event)
        await self.hub.broadcast({"type": "occupancy", "state": state, "event": {**event, "timestamp": event["timestamp"].isoformat()}})
        return state

    async def correction(self, zone_id: str, occupancy: int, reason: str, administrator: str) -> dict:
        state, previous = self.manager.correct(zone_id, occupancy)
        self.repository.enqueue("occupancy_corrections", {"zone_id": zone_id, "previous": previous, "occupancy": occupancy, "reason": reason, "administrator": administrator})
        await self.hub.broadcast({"type": "correction", "state": state})
        return state

    def snapshot(self) -> None:
        for state in self.manager.all():
            self.repository.enqueue("occupancy_snapshots", state)

