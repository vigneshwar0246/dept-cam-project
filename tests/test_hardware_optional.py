import os

import cv2
import pytest
import torch


@pytest.mark.skipif(os.getenv("RUN_HARDWARE_TESTS") != "1", reason="set RUN_HARDWARE_TESTS=1 to test local hardware")
def test_cuda_and_webcam_hardware():
    assert torch.cuda.is_available()
    camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    try:
        assert camera.isOpened()
        ok, frame = camera.read()
        assert ok and frame is not None
    finally:
        camera.release()

