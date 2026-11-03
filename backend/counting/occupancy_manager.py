from dataclasses import dataclass, asdict
from datetime import UTC, datetime
from threading import RLock


@dataclass
class ZoneState:
    zone_id: str
    occupancy: int = 0
    entries: int = 0
    exits: int = 0
    updated_at: str = ""


class OccupancyManager:
    def __init__(self) -> None:
        self._zones: dict[str, ZoneState] = {}
        self._lock = RLock()

    def apply(self, zone_id: str, event_type: str) -> dict:
        with self._lock:
            state = self._zones.setdefault(zone_id, ZoneState(zone_id))
            if event_type == "enter":
                state.occupancy += 1
                state.entries += 1
            elif event_type == "exit":
                state.occupancy = max(0, state.occupancy - 1)
                state.exits += 1
            else:
                raise ValueError("event type must be enter or exit")
            state.updated_at = datetime.now(UTC).isoformat()
            return asdict(state)

    def correct(self, zone_id: str, occupancy: int) -> tuple[dict, int]:
        with self._lock:
            state = self._zones.setdefault(zone_id, ZoneState(zone_id))
            previous = state.occupancy
            state.occupancy = occupancy
            state.updated_at = datetime.now(UTC).isoformat()
            return asdict(state), previous

    def restore(self, zone_id: str, occupancy: int, entries: int = 0, exits: int = 0) -> None:
        with self._lock:
            self._zones[zone_id] = ZoneState(zone_id, max(0, occupancy), entries, exits, datetime.now(UTC).isoformat())

    def get(self, zone_id: str) -> dict:
        with self._lock:
            return asdict(self._zones.setdefault(zone_id, ZoneState(zone_id)))

    def all(self) -> list[dict]:
        with self._lock:
            return [asdict(item) for item in self._zones.values()]

