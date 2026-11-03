from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from backend.camera.camera_manager import CameraManager
from backend.schemas.models import CameraCreate


def laptop(camera_id="cam1"):
    return CameraCreate(id=camera_id, name="Door", type="laptop", zone_id="dept", source=0)


def test_camera_configuration_validation():
    with pytest.raises(ValidationError):
        CameraCreate(id="bad id", name="Door", type="rtsp", zone_id="dept", source="http://wrong")


def test_multiple_cameras_are_independent():
    manager = CameraManager()
    manager.add(laptop("one"))
    manager.add(laptop("two"))
    assert {camera.config.id for camera in manager.list()} == {"one", "two"}


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

