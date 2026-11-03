from time import monotonic


class TrackManager:
    def __init__(self, ttl_seconds: float = 30) -> None:
        self.ttl_seconds = ttl_seconds
        self._seen: dict[int, float] = {}

    def update(self, track_ids: list[int]) -> None:
        now = monotonic()
        for track_id in track_ids:
            self._seen[track_id] = now
        self._seen = {key: value for key, value in self._seen.items() if now - value <= self.ttl_seconds}

    @property
    def active_ids(self) -> set[int]:
        return set(self._seen)

