from backend.camera.camera_manager import CameraManager
from backend.core.config import Settings
from backend.detection.person_detector import PersonDetector
from backend.services.occupancy_service import OccupancyService
from backend.services.video_processor import VideoProcessor
from backend.utils.performance_monitor import PerformanceMonitor
from backend.schemas.models import CameraUpdate


class CameraService:
    def __init__(self, manager: CameraManager, detector: PersonDetector, occupancy: OccupancyService, performance: PerformanceMonitor, settings: Settings) -> None:
        self.manager, self.detector, self.occupancy, self.performance, self.settings = manager, detector, occupancy, performance, settings
        self.processors: dict[str, VideoProcessor] = {}

    def start(self, camera_id: str) -> None:
        camera = self.manager.get(camera_id)
        camera.start()
        processor = self.processors.get(camera_id)
        if not processor:
            processor = VideoProcessor(camera, self.detector, self.occupancy, self.performance, self.settings.inference_fps)
            self.processors[camera_id] = processor
        processor.start()

    async def stop(self, camera_id: str) -> None:
        if camera_id in self.processors:
            await self.processors.pop(camera_id).stop()
        self.manager.get(camera_id).stop()
        self.detector.reset(camera_id)
        self.performance.reset(camera_id)

    async def update(self, camera_id: str, payload: CameraUpdate):
        camera = self.manager.get(camera_id)
        was_running = camera.status in {"running", "connecting", "reconnecting"}
        await self.stop(camera_id)
        updated = self.manager.update(camera_id, payload)
        if was_running:
            self.start(camera_id)
        return updated

    async def stop_all(self) -> None:
        for camera_id in list(self.processors):
            await self.stop(camera_id)
        self.manager.stop_all()

