# Department Occupancy Dashboard

React + TypeScript + Vite frontend for the Department Occupancy Tracking System.

## Current status

The frontend project is configured and builds as a standard React 19 application, but `src/App.tsx` still contains the Vite starter interface. It is not yet connected to the backend and must not be treated as a finished occupancy dashboard.

The functional backend lives in `../backend`. Its Swagger documentation is available at <http://127.0.0.1:8000/docs> when running.

## Technology

- React 19
- TypeScript 5.9
- Vite 8
- Axios
- Recharts
- Lucide React
- ESLint and Prettier

## Start the frontend

Run the backend first from the repository root:

```powershell
Set-Location D:\Department-Occupancy-Tracking
.\venv\Scripts\Activate.ps1
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Then open another PowerShell terminal:

```powershell
Set-Location D:\Department-Occupancy-Tracking\frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

## Available scripts

```powershell
npm run dev      # development server with hot reload
npm run build    # TypeScript check and production build
npm run lint     # ESLint
npm run preview  # preview the generated production build
```

## Backend connection

The backend defaults are:

```text
REST API:  http://127.0.0.1:8000/api
Swagger:   http://127.0.0.1:8000/docs
Occupancy: ws://127.0.0.1:8000/ws/occupancy
Cameras:   ws://127.0.0.1:8000/ws/cameras/{camera_id}
```

The backend permits `http://localhost:5173` through CORS by default. If the frontend runs elsewhere, add its origin to `CORS_ORIGINS` in the root `.env` file.

For deployment-specific URLs, add a frontend environment file:

```dotenv
VITE_API_URL=http://127.0.0.1:8000/api
VITE_WS_URL=ws://127.0.0.1:8000
```

Only variables prefixed with `VITE_` are exposed to browser code. Never put MongoDB credentials, camera passwords, or the administrator API key in a committed frontend environment file.

## Dashboard integration contract

The future dashboard should use:

- `GET /api/occupancy` for all current zones
- `GET /api/occupancy/{zone_id}` for one zone
- `GET /api/events` for paginated crossing history
- `GET /api/events/summary` for entry/exit totals
- `GET /api/analytics/daily` for daily charts
- `GET /api/analytics/hourly` for hourly charts
- `GET /api/analytics/peak-hours` for busiest periods
- `GET /api/cameras` for camera status and configuration
- `GET /api/cameras/{camera_id}/snapshot` for occasional JPEG previews
- `GET /api/system/performance` for FPS, latency, queues, and GPU metrics
- `/ws/occupancy` for live occupancy/event updates
- `/ws/cameras/{camera_id}` for live camera status and inference metrics

Do not stream camera video through WebSockets. Poll the snapshot endpoint at a controlled rate only when a preview is visible.

## Authentication

Read-only health, occupancy, events, analytics, camera status, and snapshots are currently accessible without an API key. Camera creation/editing/deletion, start/stop operations, and occupancy corrections require:

```http
X-API-Key: configured-backend-secret
```

Avoid permanently storing the administrator key in browser local storage. For a production multi-user dashboard, place the backend behind an identity-aware server or proxy and perform privileged operations through that trusted layer.

## Suggested dashboard screens

1. Overview — live occupancy cards, total entries/exits, connection health
2. Cameras — status, measured FPS/latency, preview, start/stop controls
3. Events — paginated ENTER/EXIT history with zone and camera filters
4. Analytics — daily/hourly charts and peak periods
5. Administration — camera setup, counting-line calibration, audited corrections

The frontend should display stale/offline states explicitly and should never invent occupancy or camera data while the backend is disconnected.

## Expected WebSocket behavior

- Connect once per required channel.
- Reconnect with bounded exponential backoff.
- Treat heartbeat timestamps/status as connection health.
- Apply occupancy events idempotently by refreshing authoritative zone state when uncertain.
- Close connections during component cleanup.
- Do not open one camera WebSocket for every camera unless those details are visible.

## Production build

```powershell
npm run lint
npm run build
npm run preview
```

The generated files are written to `dist/`. Serve them through a production web server or reverse proxy; `vite preview` is only a local preview command.

## Privacy requirements

- Do not add face recognition or identity labeling.
- Do not store snapshots in browser persistence.
- Avoid unnecessary preview refreshes.
- Do not expose RTSP URLs or camera credentials in the interface.
- Never log API secrets or privileged request headers.
- Clearly indicate that tracker IDs are temporary and anonymous.

## Related documentation

- [Project overview](../README.md)
- [API reference](../docs/api-reference.md)
- [Camera setup](../docs/camera-setup.md)
- [Line calibration](../docs/line-calibration.md)
- [Privacy and security](../docs/privacy-security.md)

