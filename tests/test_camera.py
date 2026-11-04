import asyncio
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from backend.camera.camera_manager import CameraManager
from backend.camera.base_camera import redact_url
from backend.schemas.models import CameraCreate
from backend.schemas.models import CameraUpdate
from backend.services.camera_service import CameraService
from backend.api.routes import processed_frame
from backend.utils.performance_monitor import PerformanceMonitor


def laptop(camera_id="cam1", source=0):
    return CameraCreate(id=camera_id, name="Door", type="laptop", zone_id="dept", source=source)


def test_camera_configuration_validation():
    with pytest.raises(ValidationError):
        CameraCreate(id="bad id", name="Door", type="rtsp", zone_id="dept", source="http://wrong")


def test_multiple_cameras_are_independent():
    manager = CameraManager()
    manager.add(laptop("one"))
    manager.add(laptop("two", 1))
    assert {camera.config.id for camera in manager.list()} == {"one", "two"}


def test_duplicate_laptop_device_is_rejected():
    manager = CameraManager()
    manager.add(laptop("one"))
    with pytest.raises(ValueError, match="already configured"):
        manager.add(laptop("two"))


def test_rtsp_password_is_redacted():
    assert redact_url("rtsp://viewer:secret@camera.local:554/live") == "rtsp://viewer:***@camera.local:554/live"


def test_updating_running_camera_restarts_processing_with_new_config():
    manager = CameraManager()
    camera = manager.add(laptop())
    camera.status = "running"
    service = CameraService(manager, MagicMock(), MagicMock(), MagicMock(), MagicMock(inference_fps=15))
    service.start = MagicMock()
    updated = asyncio.run(service.update("cam1", CameraUpdate(name="Updated")))
    assert updated.config.name == "Updated"
    service.start.assert_called_once_with("cam1")


def test_camera_connection_failure_is_reported():
    manager = CameraManager()
    camera = manager.add(laptop())
    capture = MagicMock()
    capture.isOpened.return_value = False
    with patch("backend.camera.base_camera.cv2.VideoCapture", return_value=capture):
        camera.start()
        camera._stop.wait(0.1)
        camera.stop()
    assert camera.last_error == "camera connection failed"


def test_processed_preview_never_falls_back_to_raw_frame():
    import numpy as np

    camera = CameraManager().add(laptop())
    camera.frames.put(np.zeros((10, 10, 3), dtype=np.uint8))
    assert processed_frame(camera) is None
    camera.preview_frames.put(np.ones((10, 10, 3), dtype=np.uint8))
    assert processed_frame(camera)[0].mean() == 1


def test_camera_stop_releases_tracker_and_performance_state():
    manager = CameraManager()
    manager.add(laptop())
    detector, performance = MagicMock(), MagicMock()
    service = CameraService(manager, detector, MagicMock(), performance, MagicMock(inference_fps=15))
    asyncio.run(service.stop("cam1"))
    detector.reset.assert_called_once_with("cam1")
    performance.reset.assert_called_once_with("cam1")


def test_processing_fps_uses_recent_frames_not_lifetime_average():
    monitor = PerformanceMonitor()
    with patch("backend.utils.performance_monitor.monotonic", side_effect=[10.0, 10.1, 10.2, 20.0]):
        monitor.record("cam1", 5, 1)
        monitor.record("cam1", 5, 1)
        assert monitor.snapshot()["cam1"]["processing_fps"] == pytest.approx(10)
        assert monitor.snapshot()["cam1"]["processing_fps"] == 0

