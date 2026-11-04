from collections import deque
from dataclasses import dataclass, field
from statistics import fmean
from threading import Lock
from time import monotonic


@dataclass
class CameraMetrics:
    processed: int = 0
    started_at: float = field(default_factory=monotonic)
    inference_ms: deque[float] = field(default_factory=lambda: deque(maxlen=100))
    event_latency_ms: deque[float] = field(default_factory=lambda: deque(maxlen=100))
    total_latency_ms: deque[float] = field(default_factory=lambda: deque(maxlen=100))
    people: int = 0


class PerformanceMonitor:
    def __init__(self) -> None:
        self._metrics: dict[str, CameraMetrics] = {}
        self._lock = Lock()

    def record(self, camera_id: str, inference_ms: float, people: int, event_latency_ms: float | None = None, total_latency_ms: float | None = None) -> None:
        with self._lock:
            item = self._metrics.setdefault(camera_id, CameraMetrics())
            item.processed += 1
            item.inference_ms.append(inference_ms)
            item.people = people
            if event_latency_ms is not None:
                item.event_latency_ms.append(event_latency_ms)
            if total_latency_ms is not None:
                item.total_latency_ms.append(total_latency_ms)

    def snapshot(self) -> dict:
        with self._lock:
            now = monotonic()
            return {key: {
                "processing_fps": value.processed / max(now - value.started_at, 0.001),
                "average_inference_ms": fmean(value.inference_ms) if value.inference_ms else 0,
                "average_event_latency_ms": fmean(value.event_latency_ms) if value.event_latency_ms else 0,
                "average_total_latency_ms": fmean(value.total_latency_ms) if value.total_latency_ms else 0,
                "people_detected": value.people,
                "frames_processed": value.processed,
            } for key, value in self._metrics.items()}

