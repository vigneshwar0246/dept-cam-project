import logging
from abc import ABC
from threading import Event, Thread
from time import monotonic
from urllib.parse import urlsplit, urlunsplit

import cv2

from backend.schemas.models import CameraCreate
from backend.utils.frame_buffer import LatestFrameBuffer

logger = logging.getLogger(__name__)


def redact_url(value: int | str) -> str:
    if isinstance(value, int):
        return str(value)
    parts = urlsplit(value)
    if not parts.password:
        return value
    host = parts.hostname or ""
    if parts.port:
        host += f":{parts.port}"
    netloc = f"{parts.username}:***@{host}" if parts.username else host
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


class BaseCamera(ABC):
    def __init__(self, config: CameraCreate) -> None:
        self.config = config
        self.frames = LatestFrameBuffer()
        self.status = "stopped"
        self.last_error: str | None = None
        self._stop = Event()
        self._thread: Thread | None = None
        self._capture: cv2.VideoCapture | None = None

    def _open(self) -> cv2.VideoCapture:
        backend = cv2.CAP_DSHOW if isinstance(self.config.source, int) else cv2.CAP_FFMPEG
        capture = cv2.VideoCapture(self.config.source, backend)
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
        capture.set(cv2.CAP_PROP_FPS, self.config.fps)
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return capture

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = Thread(target=self._capture_loop, name=f"capture-{self.config.id}", daemon=True)
        self._thread.start()

    def _capture_loop(self) -> None:
        failures = 0
        next_retry = 0.0
        while not self._stop.is_set():
            if monotonic() < next_retry:
                self._stop.wait(min(next_retry - monotonic(), 0.5))
                continue
            if self._capture is None or not self._capture.isOpened():
                self.status = "connecting"
                self._capture = self._open()
                if not self._capture.isOpened():
                    failures += 1
                    self.status = "error"
                    self.last_error = "camera connection failed"
                    next_retry = monotonic() + min(2 ** min(failures, 5), 30)
                    logger.warning("Camera %s connection failed (%s)", self.config.id, redact_url(self.config.source))
                    self._capture.release()
                    continue
                failures = 0
                self.status = "running"
                self.last_error = None
            ok, frame = self._capture.read()
            if ok and frame is not None:
                self.frames.put(frame)
                continue
            self.status = "reconnecting"
            self.last_error = "camera frame read failed"
            self._capture.release()
            self._capture = None
            next_retry = monotonic() + 1
        if self._capture is not None:
            self._capture.release()
        self._capture = None
        self.status = "stopped"

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        if self._capture is not None:
            self._capture.release()
        self.status = "stopped"

