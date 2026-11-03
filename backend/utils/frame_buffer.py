from threading import Lock
from time import monotonic

import numpy as np


class LatestFrameBuffer:
    def __init__(self) -> None:
        self._lock = Lock()
        self._frame: np.ndarray | None = None
        self._sequence = 0
        self._captured_at = 0.0

    def put(self, frame: np.ndarray) -> None:
        with self._lock:
            self._frame = frame
            self._sequence += 1
            self._captured_at = monotonic()

    def get(self, after_sequence: int = -1, copy: bool = False):
        with self._lock:
            if self._frame is None or self._sequence == after_sequence:
                return None
            frame = self._frame.copy() if copy else self._frame
            return frame, self._sequence, self._captured_at

