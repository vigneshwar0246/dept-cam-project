# Camera setup

Laptop: use `type: laptop` and integer `source: 0` (try 1 if index 0 is busy). Run `python backend\detection\webcam_test.py` for an interactive check.

Mobile: install an IP-camera app, connect both devices to the same trusted Wi-Fi, and copy its displayed MJPEG URL (often `http://PHONE_IP:PORT/video`). Create a `mobile` camera with that URL. Reserve the phone IP in the router.

CCTV: obtain the vendor RTSP URL and create an `rtsp` camera. Keep credentials in deployment environment configuration. Responses and logs redact URL passwords. Use a read-only camera account. Each source reconnects independently with bounded backoff.
