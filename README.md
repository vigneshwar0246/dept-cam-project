# Department Occupancy Tracking System

A real-time, privacy-conscious occupancy tracking system for department entrances. The backend accepts laptop webcams, mobile IP-camera streams, and RTSP CCTV feeds; detects people with YOLO11n; maintains anonymous tracks with ByteTrack; and updates occupancy only when a tracked person crosses a configured virtual line.

The backend is functional and tested. The React frontend currently remains a Vite starter and must still be connected to the API; see [frontend/README.md](frontend/README.md) for its integration contract.

## Features

- Laptop webcam, HTTP/MJPEG mobile camera, and RTSP CCTV support
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
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=occupancy_tracking
```

or a MongoDB Atlas connection string. Do not commit `.env` or camera credentials.

Start the API:

```powershell
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Development auto-reload:

```powershell
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Open:

- Swagger UI: <http://127.0.0.1:8000/docs>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>
- Health check: <http://127.0.0.1:8000/api/health>

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
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated frontend origins |

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

Invoke-RestMethod http://127.0.0.1:8000/api/cameras `
  -Method Post -Headers $headers -ContentType application/json -Body $body

Invoke-RestMethod http://127.0.0.1:8000/api/cameras/laptop-door/start `
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
Invoke-RestMethod http://127.0.0.1:8000/api/occupancy/department-a/correction `
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
12 passed, 1 skipped
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

The frontend is a separate React 19 + TypeScript + Vite application. It currently shows the starter UI and does not yet consume occupancy APIs.

```powershell
Set-Location D:\Department-Occupancy-Tracking\frontend
npm install
npm run dev
```

The default frontend URL is <http://localhost:5173>, already included in the backend's default CORS configuration. See [frontend/README.md](frontend/README.md) for expected API and WebSocket integration.

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

## Known limitations

- The React dashboard has not yet been implemented beyond the Vite starter.
- Live MongoDB Atlas/local connectivity depends on deployment credentials and was not required by automated tests.
- Real webcam and sustained multi-camera load testing remain environment-specific.
- Snapshot recovery cannot account for crossings that happen while the system is offline.
- Duplicate-view suppression uses a short time window and is not cross-camera person re-identification.

