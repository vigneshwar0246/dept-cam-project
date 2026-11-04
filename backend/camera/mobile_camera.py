from datetime import UTC, datetime
from time import monotonic

import numpy as np

from backend.camera.base_camera import BaseCamera


class MobileCamera(BaseCamera):
    def __init__(self, config) -> None:
        super().__init__(config)
        self.streaming_started_at: datetime | None = None
        self._streaming_started_monotonic: float | None = None
        self.last_received_at: datetime | None = None

    @property
    def is_webrtc(self) -> bool:
        return str(self.config.source).startswith("webrtc://")

    def start(self) -> None:
        if not self.is_webrtc:
            return super().start()
        self._stop.clear()
        self.status = "connecting"
        self.last_error = None

    def receive(self, frame: np.ndarray) -> None:
        if not self.is_webrtc or self._stop.is_set():
            return
        now = monotonic()
        if self._streaming_started_monotonic is None:
            self._streaming_started_monotonic = now
            self.streaming_started_at = datetime.now(UTC)
        self.last_received_at = datetime.now(UTC)
        self._frame_times.append(now)
        self.frames.put(frame)
        self.status = "running"
        self.last_error = None

    def interrupted(self, error: str = "phone connection interrupted") -> None:
        if self.is_webrtc and not self._stop.is_set():
            self.status = "reconnecting"
            self.last_error = error

    def stop(self) -> None:
        if not self.is_webrtc:
            return super().stop()
        self._stop.set()
        self.status = "stopped"
        self._streaming_started_monotonic = None
        self.streaming_started_at = None

    def health(self) -> dict:
        health = super().health()
        health.update(
            streaming_duration_seconds=(monotonic() - self._streaming_started_monotonic) if self._streaming_started_monotonic is not None else 0,
            streaming_started_at=self.streaming_started_at.isoformat() if self.streaming_started_at else None,
            last_received_at=self.last_received_at.isoformat() if self.last_received_at else None,
        )
        return health

