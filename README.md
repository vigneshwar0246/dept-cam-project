# Department Occupancy Tracking System

A real-time, privacy-conscious occupancy tracking system for department entrances. The backend accepts laptop webcams, mobile IP-camera streams, and RTSP CCTV feeds; detects people with YOLO11n; maintains anonymous tracks with ByteTrack; and updates occupancy only when a tracked person crosses a configured virtual line.

The FastAPI backend and React dashboard are integrated. Camera Management, Live Monitoring, events, analytics, occupancy WebSockets and system status use real backend data.

## Features

- Laptop webcam, HTTP/MJPEG mobile camera, and RTSP CCTV support
- One-time QR pairing for Android/iPhone browser cameras over WebRTC
- Multiple independent camera workers with automatic reconnects
- Single reusable YOLO11n model with CUDA verification and CPU fallback
- Independent ByteTrack state for each camera
- Horizontal, vertical, or diagonal virtual counting lines
- ENTER/EXIT direction classification with hysteresis and cooldown
- Multiple zones and multiple cameras per zone
- Duplicate-view suppression for cameras watching the same doorway
- In-memory live occupancy with non-negative enforcement
- MongoDB event history, corrections, snapshots, indexes, and restart recovery
- Explicit in-memory development mode when MongoDB is not configured
- FastAPI REST API, Swagger UI, and real-time WebSockets
- Bounded frame and persistence queues to avoid unbounded latency
- Runtime FPS, inference latency, event latency, and GPU metrics
- API-key protection for administrative operations
- No face recognition, biometric identification, or raw-video storage

## System flow

```text
Camera source
  -> reconnecting OpenCV capture worker
  -> latest-frame buffer
  -> YOLO11n person detection
  -> per-camera ByteTrack tracker
  -> virtual-line crossing detector
  -> zone occupancy manager
  -> WebSocket updates + bounded persistence queue
  -> MongoDB history and snapshots
```

Each camera stores only its newest frame. If inference is slower than capture, old frames are discarded rather than queued, keeping the displayed state close to real time.

## Repository structure

```text
backend/
  api/          REST routes, dependencies, WebSocket hub
  camera/       common camera interface and camera manager
  core/         settings, security, structured logging
  counting/     line crossing and occupancy state
  database/     async MongoDB connection and repository
  detection/    YOLO loader and person detection
  schemas/      Pydantic request/configuration models
  services/     camera, processing, and occupancy orchestration
  tracking/     ByteTrack-related tracking helpers
  utils/        latest-frame buffer and performance metrics
  main.py       FastAPI application and lifecycle
docs/           focused setup, API, calibration, and security guides
frontend/       React + TypeScript + Vite project
models/         optional local model directory
tests/          unit, API, WebSocket, and optional hardware tests
yolo11n.pt      local YOLO11n weights
```

## Prerequisites

- Windows 11 and PowerShell
- Python 3.11
- Existing virtual environment in `venv/`
- NVIDIA GPU and CUDA-enabled PyTorch for GPU inference, or CPU fallback
- MongoDB local/Atlas for persistent history (optional during development)
- Node.js and npm for frontend development

The requirements file intentionally does not pin or reinstall PyTorch. This protects the existing CUDA-enabled build from being replaced by a CPU-only wheel.

## Backend setup

From PowerShell:

```powershell
Set-Location D:\Department-Occupancy-Tracking
.\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item .env.example .env
notepad .env
```

At minimum, replace the example administrator secret:

```dotenv
API_AUTH_SECRET=use-a-long-random-secret-here
```

For persistent storage, configure either local MongoDB:

```dotenv
DATABASE_URL=mongodb://127.0.0.1:27017
DATABASE_NAME=occupancy_tracking
```

or a MongoDB Atlas connection string. Do not commit `.env` or camera credentials.

Start the API:

```powershell
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --ssl-certfile .certs\lan.pem --ssl-keyfile .certs\lan-key.pem
```

Development auto-reload:

```powershell
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 --ssl-certfile .certs\lan.pem --ssl-keyfile .certs\lan-key.pem
```

Open:

- Swagger UI: <https://192.168.1.6:8000/docs>
- OpenAPI JSON: <https://192.168.1.6:8000/openapi.json>
- Health check: <https://192.168.1.6:8000/api/health>

## Verify CUDA and YOLO

Verify the installed PyTorch build without changing it:

```powershell
python -c "import torch; print('PyTorch:', torch.__version__); print('CUDA:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU fallback')"
```

The application selects `cuda:0` when `YOLO_DEVICE=auto` and CUDA is actually available. If model initialization fails on CUDA, the fallback is logged and inference continues on CPU.

Verified on this workstation during implementation:

- PyTorch: `2.14.1+cu130`
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- YOLO11n device: `cuda:0`
- Measured model inference on a blank 640×640 frame: approximately `21.14 ms`
- Allocated GPU memory during that check: approximately `54.83 MB`

The first cold inference took about 5.8 seconds because model and CUDA initialization were included. These figures are measurements from one run, not guaranteed production performance.

## Configuration

All settings are read from environment variables or `.env` through Pydantic Settings.

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | `development`, `test`, or `production` |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | API bind address |
| `LOG_LEVEL` | `INFO` | Structured log verbosity |
| `DATABASE_URL` | empty | MongoDB connection string; empty enables memory mode |
| `DATABASE_NAME` | `occupancy_tracking` | MongoDB database |
| `YOLO_MODEL_PATH` | `yolo11n.pt` | Model weights path |
| `YOLO_DEVICE` | `auto` | `auto`, `cpu`, or a CUDA device such as `cuda:0` |
| `YOLO_IMAGE_SIZE` | `640` | Inference image size |
| `YOLO_CONFIDENCE` | `0.35` | Person confidence threshold |
| `YOLO_FP16` | `true` | Half precision when using CUDA |
| `INFERENCE_FPS` | `15` | Maximum processing rate per camera |
| `TRACKER_CONFIG` | `bytetrack.yaml` | Ultralytics tracker configuration |
| `OCCUPANCY_SNAPSHOT_INTERVAL` | `30` | Snapshot interval in seconds |
| `WEBSOCKET_UPDATE_INTERVAL` | `1` | Heartbeat interval in seconds |
| `PERSISTENCE_QUEUE_SIZE` | `1000` | Maximum queued database writes |
| `API_AUTH_SECRET` | insecure example | Value expected in `X-API-Key` |
| `CORS_ORIGINS` | current LAN HTTPS UI | Comma-separated exact frontend origins |
| `PHONE_FRONTEND_URL` | current LAN HTTPS UI | Trusted, phone-reachable HTTPS origin placed in pairing QR codes |
| `PAIRING_TTL_SECONDS` | `120` | Lifetime of an unused one-time pairing session |
| `WEBRTC_RECONNECT_GRACE_SECONDS` | `300` | Cleanup delay for an interrupted, inactive peer; not an active-stream limit |
| `WEBRTC_STUN_URLS` | Google public STUN | Comma-separated ICE discovery servers; may be empty for LAN-only host candidates |
| `WEBRTC_TURN_*` | empty | Optional TURN URLs and environment-injected credentials |

See [.env.example](.env.example) for the complete template. Production refuses to start with the built-in default API secret.

## Camera configuration

Administrative requests require the configured API key:

```powershell
$headers = @{ 'X-API-Key' = 'your-api-secret' }
```

### Laptop webcam

```powershell
$body = @{
  id = 'laptop-door'
  name = 'Laptop entrance camera'
  type = 'laptop'
  zone_id = 'department-a'
  source = 0
  width = 1280
  height = 720
  fps = 15
  line = @{
    start = @{ x = 0.10; y = 0.50 }
    end = @{ x = 0.90; y = 0.50 }
    enter_side = 'positive'
    cooldown_seconds = 2
    hysteresis = 0.01
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod https://192.168.1.6:8000/api/cameras `
  -Method Post -Headers $headers -ContentType application/json -Body $body

Invoke-RestMethod https://192.168.1.6:8000/api/cameras/laptop-door/start `
  -Method Post -Headers $headers
```

Try camera index `1` if index `0` is unavailable. An optional interactive webcam check is also available:

```powershell
python backend\detection\webcam_test.py
```

### Mobile IP camera

Connect the phone and laptop to the same trusted Wi-Fi network. An IP-camera application normally displays a URL similar to `http://192.168.1.50:8080/video`.

Use:

```json
{
  "id": "mobile-door",
  "name": "Mobile entrance camera",
  "type": "mobile",
  "zone_id": "department-a",
  "source": "http://192.168.1.50:8080/video"
}
```

HTTP/HTTPS MJPEG and RTSP-style mobile streams are accepted.

### Browser phone camera (QR + WebRTC)

The Camera Management page also has a **Phone Camera** button beside **Laptop Camera**. It creates an administrator-authorized, one-use QR token that must be claimed within 120 seconds. After a phone claims it, the active WebRTC camera has no automatic duration limit and can run until the user selects **Stop Camera**. The QR token is stored in the URL fragment so it is not sent in the initial page request or server access logs. The phone explicitly grants camera access and sends encrypted WebRTC video; the backend does not mark it connected until the first decoded frame reaches the shared latest-frame buffer.

Temporary network failures retain the same camera processor, ByteTrack instance, line counter, and occupancy state while the browser renegotiates a replacement peer connection. By default, an uninterrupted five-minute disconnection is treated as permanently closed and its resources are released. This grace period applies only while no media connection is active; it never limits a healthy stream.

Mobile camera access requires a trusted HTTPS LAN origin. Follow the complete Windows, Android Chrome, iPhone Safari, firewall, STUN/TURN, and troubleshooting guide in [docs/phone-camera.md](docs/phone-camera.md).

### RTSP CCTV

```json
{
  "id": "cctv-door-1",
  "name": "Main CCTV entrance",
  "type": "rtsp",
  "zone_id": "department-a",
  "source": "rtsp://camera-user:camera-password@192.168.1.60:554/stream1"
}
```

Use a read-only camera account. Passwords embedded in RTSP URLs are redacted from API responses and logs, but secrets should still be injected through protected deployment configuration rather than committed files.

## Virtual-line calibration

Line coordinates are normalized from `0` to `1`, so they remain meaningful if resolution changes. The tracked person's bottom-center point is used as the approximate foot position.

1. Start the camera.
2. Open `/api/cameras/{camera_id}/snapshot` in a browser.
3. Choose two points across the doorway, perpendicular to walking direction.
4. Update the camera configuration with those normalized points.
5. Walk through once in both directions.
6. Reverse `enter_side` if ENTER and EXIT are swapped.

Touching the line is not enough to count. The track must move from one side to the other beyond the configured hysteresis. See [docs/line-calibration.md](docs/line-calibration.md).

## API overview

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health`, `/api/system/status`, `/api/system/performance` |
| Cameras | `GET/POST /api/cameras`, `GET/PUT/DELETE /api/cameras/{id}` |
| Camera control | `POST /api/cameras/{id}/start`, `/stop` |
| Camera preview/config | `GET /api/cameras/{id}/stream`, `/snapshot`, `GET/PUT /api/cameras/{id}/config` |
| Local discovery | `GET /api/cameras/discover/local` (administrator) |
| Occupancy | `GET /api/occupancy`, `GET /api/occupancy/{zone}` |
| Correction/history | `POST /api/occupancy/{zone}/correction`, `GET /api/occupancy/history` |
| Events | `GET /api/events`, `GET /api/events/summary` |
| Analytics | `GET /api/analytics/daily`, `/hourly`, `/peak-hours` |
| WebSockets | `/ws/occupancy`, `/ws/cameras/{camera_id}` |

Mutating camera operations and occupancy corrections require `X-API-Key`. Historical endpoints use `page` and `page_size`, with a maximum page size of 200.

### WebSocket payloads

`/ws/occupancy` sends occupancy heartbeats and crossing/correction broadcasts. `/ws/cameras/{camera_id}` sends camera connection state, people count, and measured inference latency. Raw frames are not sent over WebSockets; visible previews use the processed MJPEG stream endpoint, while snapshots support calibration.

## Occupancy corrections

If the system was offline while people entered or exited, the missed crossings cannot be reconstructed from the last snapshot. Perform a physical headcount and submit an audited correction:

```powershell
$correction = @{ occupancy = 12; reason = 'Physical headcount after outage' } | ConvertTo-Json
Invoke-RestMethod https://192.168.1.6:8000/api/occupancy/department-a/correction `
  -Method Post -Headers $headers -ContentType application/json -Body $correction
```

The correction stores the old value, new value, reason, administrator name, and UTC timestamp.

## MongoDB storage

The backend creates and uses:

- `cameras` — persistent camera configurations
- `occupancy_events` — ENTER/EXIT crossings with zone, camera, and anonymous track ID
- `occupancy_snapshots` — periodic recovery points
- `occupancy_corrections` — manual correction audit trail

Indexes cover camera IDs and common zone/camera/timestamp history queries. Database writes are moved off the inference loop through a bounded asynchronous queue.

With no `DATABASE_URL`, data lives only for the current process. This mode is intended for development and automated tests.

## Tests

Run the full non-hardware suite:

```powershell
.\venv\Scripts\python.exe -m pytest -q
```

Current verified result:

```text
32 passed, 1 skipped
```

The skipped test requires a real webcam and CUDA GPU. Run it explicitly:

```powershell
$env:RUN_HARDWARE_TESTS = '1'
.\venv\Scripts\python.exe -m pytest -q tests\test_hardware_optional.py
Remove-Item Env:RUN_HARDWARE_TESTS
```

Other verification commands:

```powershell
.\venv\Scripts\python.exe -m pip check
.\venv\Scripts\python.exe -m compileall -q backend tests
```

## Frontend

The frontend is a React 19 + TypeScript + Vite dashboard connected to the backend REST and WebSocket APIs.

```powershell
Set-Location D:\Department-Occupancy-Tracking\frontend
npm install
npm run dev
```

For the current trusted LAN configuration, open <https://192.168.1.6:5173>. Do not mix this origin with localhost because the exact HTTPS origin is enforced by CORS and is embedded in phone pairing URLs.

## Privacy and security

- No face recognition or biometric identification
- No raw-video or person-crop persistence
- Temporary anonymous tracker IDs only
- Snapshot responses use `Cache-Control: no-store`
- Credentials are redacted from camera API responses and logs
- Administrative mutations require an API key
- `.env`, model weights, caches, and virtual environments are excluded from source control

For production, add TLS, an identity-aware reverse proxy, secret rotation, rate limiting, network isolation, and least-privilege camera/database accounts. An API key alone is appropriate for this initial controlled deployment, not a public internet service.

## Performance guidance

Use `/api/system/performance` for actual values. Performance depends on camera resolution, codecs, network quality, stream count, image size, and GPU contention. Start with 640-pixel inference and 15 inference FPS, then tune based on observed latency.

The application deliberately favors fresh frames over processing every captured frame. Do not increase buffer or queue sizes to conceal a consistently slow inference or database path.

## Troubleshooting

### Camera does not open

- Confirm Windows camera permissions.
- Close applications already using the webcam.
- Try camera index `1`.
- Verify the RTSP/MJPEG URL using VLC before adding it.
- Check firewall, VLAN, and camera account permissions.

### CUDA is unavailable

- Run the CUDA verification command above.
- Confirm the NVIDIA driver and CUDA-enabled PyTorch build.
- Do not run a generic `pip install torch` over the working environment.
- The backend will log and use CPU fallback when needed.

### Occupancy direction is reversed

Change the line's `enter_side` between `positive` and `negative`; do not swap business meaning in frontend code.

### Database is not persistent

Check that `DATABASE_URL` is populated and `/api/health` reports `connected`. An empty URL intentionally selects development-memory mode.

## Additional documentation

- [Architecture](docs/architecture.md)
- [Setup](docs/setup.md)
- [Camera setup](docs/camera-setup.md)
- [Line calibration](docs/line-calibration.md)
- [API reference](docs/api-reference.md)
- [Performance](docs/performance.md)
- [Privacy and security](docs/privacy-security.md)
- [Phone camera pairing](docs/phone-camera.md)

## Known limitations

- Live MongoDB Atlas/local connectivity depends on deployment credentials and was not required by automated tests.
- Real webcam and sustained multi-camera load testing remain environment-specific.
- Snapshot recovery cannot account for crossings that happen while the system is offline.
- Duplicate-view suppression uses a short time window and is not cross-camera person re-identification.

-------------------------------------------------------
Risk: if your LAN IP changes, update .env, frontend/.env, and regenerate the HTTPS certificate for the new IP. MongoDB Compass alone does not start MongoDB—the configured database server must also be running.
--------------------------------------------------------

