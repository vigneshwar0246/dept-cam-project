import logging
from threading import Lock

import torch
from ultralytics import YOLO

from backend.core.config import Settings

logger = logging.getLogger(__name__)


class ModelLoader:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        requested = settings.yolo_device
        self.device = "cuda:0" if requested == "auto" and torch.cuda.is_available() else ("cpu" if requested == "auto" else requested)
        if self.device.startswith("cuda") and not torch.cuda.is_available():
            logger.warning("CUDA requested but unavailable; falling back to CPU")
            self.device = "cpu"
        self.fp16 = settings.yolo_fp16 and self.device.startswith("cuda")
        self.model: YOLO | None = None
        self._lock = Lock()
        self.error: str | None = None

    def load(self) -> YOLO:
        with self._lock:
            if self.model is None:
                try:
                    self.model = YOLO(self.settings.effective_model_path)
                    self.model.to(self.device)
                    logger.info("YOLO loaded on verified device %s (FP16=%s)", self.device, self.fp16)
                except Exception as exc:
                    self.error = str(exc)
                    if self.device != "cpu":
                        logger.exception("GPU model initialization failed; retrying on CPU")
                        self.device, self.fp16 = "cpu", False
                        self.model = YOLO(self.settings.effective_model_path)
                    else:
                        raise
            return self.model

    def status(self) -> dict:
        return {"loaded": self.model is not None, "device": self.device, "fp16": self.fp16, "error": self.error}

