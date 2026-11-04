from threading import RLock

from backend.camera.base_camera import BaseCamera, redact_url
from backend.camera.laptop_camera import LaptopCamera
from backend.camera.mobile_camera import MobileCamera
from backend.camera.rtsp_camera import RTSPCamera
from backend.schemas.models import CameraCreate, CameraType, CameraUpdate


class CameraManager:
    def __init__(self) -> None:
        self._cameras: dict[str, BaseCamera] = {}
        self._lock = RLock()

    def add(self, config: CameraCreate) -> BaseCamera:
        classes = {CameraType.LAPTOP: LaptopCamera, CameraType.MOBILE: MobileCamera, CameraType.RTSP: RTSPCamera}
        with self._lock:
            if config.id in self._cameras:
                raise ValueError("camera already exists")
            if config.type == CameraType.LAPTOP and any(
                item.config.type == CameraType.LAPTOP and item.config.source == config.source
                for item in self._cameras.values()
            ):
                raise ValueError("laptop camera device is already configured")
            camera = classes[config.type](config)
            self._cameras[config.id] = camera
            return camera

    def get(self, camera_id: str) -> BaseCamera:
        try:
            return self._cameras[camera_id]
        except KeyError as exc:
            raise KeyError("camera not found") from exc

    def list(self) -> list[BaseCamera]:
        with self._lock:
            return list(self._cameras.values())

    def update(self, camera_id: str, update: CameraUpdate) -> BaseCamera:
        old = self.get(camera_id)
        was_running = old.status not in {"stopped", "error"}
        data = old.config.model_dump()
        data.update(update.model_dump(exclude_none=True))
        config = CameraCreate.model_validate(data)
        old.stop()
        with self._lock:
            del self._cameras[camera_id]
            camera = self.add(config)
        if was_running:
            camera.start()
        return camera

    def remove(self, camera_id: str) -> None:
        camera = self.get(camera_id)
        camera.stop()
        with self._lock:
            del self._cameras[camera_id]

    def stop_all(self) -> None:
        for camera in self.list():
            camera.stop()

    @staticmethod
    def public(camera: BaseCamera) -> dict:
        data = camera.config.model_dump(mode="json")
        data["source"] = redact_url(camera.config.source)
        data.update(status=camera.status, error=camera.last_error, **camera.health())
        return data

