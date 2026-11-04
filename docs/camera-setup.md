# Camera setup

All camera types use the same latest-frame buffer, YOLO11n detector, per-camera ByteTrack instance, line counter, persistence, and WebSocket event path.

## Laptop webcam

1. Start MongoDB, FastAPI, and the frontend.
2. Sign in as administrator and open **Camera Management**.
3. Select **Add Camera → Laptop Webcam**.
4. Use **Discover laptop cameras**. Close Teams, Camera, Zoom, or other applications if discovery fails.
5. Enter the returned integer device index, normally `0`, plus the desired resolution and FPS.
6. Save and press Start. The camera is `Online` only after OpenCV receives frames.
7. Open Live Monitoring for the processed MJPEG preview with real boxes, anonymous track IDs, and counting line.

Windows must allow desktop applications under **Settings → Privacy & security → Camera**. Only one configured laptop camera may own a given device index.

Opt-in hardware check:

```powershell
$env:RUN_HARDWARE_TESTS='1'
.\venv\Scripts\python.exe -m pytest -q tests\test_hardware_optional.py
```

## Mobile phone over QR + WebRTC

Browser WebRTC pairing is implemented. Open **Camera Management**, select **Phone Camera**, enter the camera name, stable camera ID and zone, then scan the real one-time QR code. The phone page requests camera permission only after **Start streaming** is pressed. The unused QR token expires after 120 seconds; a claimed active stream has no fixed duration. See [phone-camera.md](phone-camera.md) and the root [camera_flow.md](../camera_flow.md).

The backend reports capture as connected only after aiortc decodes a real frame. Live Monitoring stays **Connecting** until the shared YOLO/ByteTrack processor has produced its first annotated preview.

## Legacy mobile IP-camera URL

HTTP/HTTPS MJPEG and RTSP URLs from a phone IP-camera application remain supported through the generic **Laptop Camera** form by changing **Camera type** to **Mobile Camera**.

1. Connect the phone and laptop to the same trusted Wi-Fi network. Guest networks often block device-to-device traffic.
2. Install and start a reputable IP-camera application on the phone.
3. Note its stream address, commonly `http://PHONE_IP:PORT/video`.
4. Verify that address opens from the laptop browser.
5. Add a **Mobile Camera**, enter the URL, save, and start it.
6. Reserve the phone IP in the router to keep the URL stable.

Do not expose either transport to the public internet. Browser pairing requires the trusted LAN HTTPS origin documented in `phone-camera.md`.

## RTSP CCTV

Add a **CCTV / RTSP Camera** with a vendor-provided `rtsp://` or `rtsps://` URL. Use a read-only camera account. URL passwords are redacted from API responses and logs. Each camera reconnects independently with bounded exponential backoff.

ONVIF discovery is not implemented. Obtain the exact RTSP path from the camera vendor.

## Preview and performance

- `/api/cameras/{id}/stream` is a continuous MJPEG preview of the latest processed frame.
- `/api/cameras/{id}/snapshot` returns one current processed JPEG for calibration.
- `/api/system/performance` reports measured processing FPS, inference time, total capture-to-processing latency, and queue state.
- Camera responses report capture FPS, last-frame age, and whether a frame has ever arrived.

No raw video or person crops are persisted by default.
