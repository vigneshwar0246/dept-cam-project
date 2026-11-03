from dataclasses import dataclass
from time import perf_counter
from threading import Lock

import numpy as np

from backend.core.config import Settings
from backend.detection.model_loader import ModelLoader
from ultralytics.trackers.byte_tracker import BYTETracker
from ultralytics.utils import IterableSimpleNamespace, YAML
from ultralytics.utils.checks import check_yaml


@dataclass(frozen=True)
class Detection:
    track_id: int
    box: tuple[float, float, float, float]
    confidence: float

    @property
    def foot(self) -> tuple[float, float]:
        x1, _, x2, y2 = self.box
        return ((x1 + x2) / 2, y2)


class PersonDetector:
    def __init__(self, loader: ModelLoader, settings: Settings) -> None:
        self.loader, self.settings = loader, settings
        self._trackers: dict[str, BYTETracker] = {}
        self._inference_lock = Lock()

    def track(self, frame: np.ndarray, camera_id: str = "default") -> tuple[list[Detection], float]:
        started = perf_counter()
        with self._inference_lock:
            results = self.loader.load().predict(
                source=frame, device=self.loader.device, imgsz=self.settings.yolo_image_size,
                classes=[0], conf=self.settings.effective_confidence,
                half=self.loader.fp16, verbose=False,
            )
        latency_ms = (perf_counter() - started) * 1000
        boxes = results[0].boxes
        if boxes is None:
            return [], latency_ms
        tracker = self._trackers.get(camera_id)
        if tracker is None:
            cfg = IterableSimpleNamespace(**YAML.load(check_yaml(self.settings.tracker_config)))
            tracker = self._trackers[camera_id] = BYTETracker(cfg)
        tracked = tracker.update(boxes.cpu().numpy(), frame)
        return [Detection(int(row[4]), tuple(map(float, row[:4])), float(row[5])) for row in tracked], latency_ms

