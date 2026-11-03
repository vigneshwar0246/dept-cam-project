from dataclasses import dataclass
from time import monotonic

from backend.counting.direction_detector import signed_side
from backend.schemas.models import LineConfig


@dataclass(frozen=True)
class Crossing:
    track_id: int
    event_type: str


class LineCounter:
    def __init__(self, config: LineConfig) -> None:
        self.config = config
        self._sides: dict[int, int] = {}
        self._crossed_at: dict[int, float] = {}
        self._seen_at: dict[int, float] = {}

    def update(self, track_id: int, point: tuple[float, float], frame_size: tuple[int, int]) -> Crossing | None:
        width, height = frame_size
        normalized = (point[0] / width, point[1] / height)
        value = signed_side(normalized, (self.config.start.x, self.config.start.y), (self.config.end.x, self.config.end.y))
        now = monotonic()
        self._seen_at[track_id] = now
        if abs(value) <= self.config.hysteresis:
            return None
        side = 1 if value > 0 else -1
        previous = self._sides.get(track_id)
        self._sides[track_id] = side
        if previous is None or previous == side:
            self._expire(now)
            return None
        if now - self._crossed_at.get(track_id, float("-inf")) < self.config.cooldown_seconds:
            return None
        self._crossed_at[track_id] = now
        enter_positive = self.config.enter_side == "positive"
        event_type = "enter" if (side > 0) == enter_positive else "exit"
        self._expire(now)
        return Crossing(track_id, event_type)

    def _expire(self, now: float) -> None:
        expired = [key for key, value in self._seen_at.items() if now - value > 60]
        for key in expired:
            self._seen_at.pop(key, None)
            self._sides.pop(key, None)
            self._crossed_at.pop(key, None)

