from types import SimpleNamespace
from unittest.mock import MagicMock

import numpy as np

from backend.core.config import Settings
from backend.detection.person_detector import PersonDetector


class TensorValue:
    def __init__(self, value): self.value = value
    def cpu(self): return self
    def int(self): return self
    def tolist(self): return self.value


def test_detection_output_validation():
    boxes = SimpleNamespace(xyxy=TensorValue([[1, 2, 10, 20]]), id=TensorValue([7]), conf=TensorValue([0.9]))
    boxes.cpu = lambda: boxes
    boxes.numpy = lambda: boxes
    model = MagicMock()
    model.predict.return_value = [SimpleNamespace(boxes=boxes)]
    loader = SimpleNamespace(load=lambda: model, device="cpu", fp16=False)
    detector = PersonDetector(loader, Settings(app_env="test", _env_file=None))
    tracker = MagicMock()
    tracker.update.return_value = np.array([[1, 2, 10, 20, 7, 0.9, 0, 0]])
    detector._trackers["default"] = tracker
    detections, latency = detector.track(np.zeros((32, 32, 3), dtype=np.uint8))
    assert detections[0].track_id == 7 and detections[0].foot == (5.5, 20.0)
    assert latency >= 0


def test_no_tracking_ids_returns_empty():
    model = MagicMock()
    model.predict.return_value = [SimpleNamespace(boxes=None)]
    loader = SimpleNamespace(load=lambda: model, device="cpu", fp16=False)
    assert PersonDetector(loader, Settings(app_env="test", _env_file=None)).track(np.zeros((2, 2, 3)))[0] == []


def test_tracker_state_is_isolated_by_camera_id():
    boxes = MagicMock()
    boxes.cpu.return_value.numpy.return_value = boxes
    model = MagicMock()
    model.predict.return_value = [SimpleNamespace(boxes=boxes)]
    detector = PersonDetector(SimpleNamespace(load=lambda: model, device="cpu", fp16=False), Settings(app_env="test", _env_file=None))
    first, second = MagicMock(), MagicMock()
    first.update.return_value = second.update.return_value = np.empty((0, 8))
    detector._trackers.update(first=first, second=second)
    frame = np.zeros((16, 16, 3), dtype=np.uint8)
    detector.track(frame, "first")
    detector.track(frame, "second")
    first.update.assert_called_once()
    second.update.assert_called_once()


def test_tracker_state_can_be_released_for_stopped_camera():
    detector = PersonDetector(SimpleNamespace(), Settings(app_env="test", _env_file=None))
    detector._trackers["camera"] = MagicMock()
    detector.reset("camera")
    assert "camera" not in detector._trackers

