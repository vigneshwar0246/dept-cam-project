import asyncio
import logging
from time import monotonic

from backend.camera.base_camera import BaseCamera
from backend.counting.line_counter import LineCounter
from backend.detection.person_detector import PersonDetector
from backend.services.occupancy_service import OccupancyService
from backend.utils.performance_monitor import PerformanceMonitor

logger = logging.getLogger(__name__)


class VideoProcessor:
    def __init__(self, camera: BaseCamera, detector: PersonDetector, occupancy: OccupancyService, performance: PerformanceMonitor, inference_fps: float) -> None:
        self.camera, self.detector, self.occupancy, self.performance = camera, detector, occupancy, performance
        self.counter = LineCounter(camera.config.line)
        self.interval = 1 / inference_fps
        self.task: asyncio.Task | None = None
        self._running = False

    def start(self) -> None:
        if not self.task or self.task.done():
            self._running = True
            self.task = asyncio.create_task(self.run())

    async def stop(self) -> None:
        self._running = False
        if self.task:
            await self.task

    async def run(self) -> None:
        sequence = -1
        last_processed = 0.0
        while self._running:
            wait = self.interval - (monotonic() - last_processed)
            if wait > 0:
                await asyncio.sleep(wait)
            item = self.camera.frames.get(sequence)
            if item is None:
                await asyncio.sleep(0.01)
                continue
            frame, sequence, captured_at = item
            last_processed = monotonic()
            try:
                detections, latency = await asyncio.to_thread(self.detector.track, frame, self.camera.config.id)
                h, w = frame.shape[:2]
                event_latency = None
                for detection in detections:
                    crossing = self.counter.update(detection.track_id, detection.foot, (w, h))
                    if crossing:
                        event_latency = (monotonic() - captured_at) * 1000
                        await self.occupancy.event(self.camera.config.zone_id, self.camera.config.id, crossing.event_type, crossing.track_id, self.camera.config.duplicate_group)
                self.performance.record(self.camera.config.id, latency, len(detections), event_latency)
                await self.occupancy.hub.broadcast({"type": "camera", "camera_id": self.camera.config.id, "status": self.camera.status, "people": len(detections), "inference_ms": latency}, self.camera.config.id)
            except Exception:
                logger.exception("Video processing failed for camera %s", self.camera.config.id)

