# Troubleshooting

- MongoDB: confirm the service is running and check `DATABASE_URL` and `DATABASE_NAME`.
- Frontend offline: verify `/api/health`, `frontend/.env`, and the allowed CORS origin (`http://localhost:5173`).
- API key rejected: use the backend `API_AUTH_SECRET`. It is held only in frontend memory and cleared on refresh/logout.
- No camera preview: start the camera and verify its device index or stream URL. Snapshots return 503 until a frame exists.
- Empty analytics: charts require persisted entry/exit events.

```powershell
.\venv\Scripts\python.exe -m pytest -q
.\venv\Scripts\python.exe -m compileall -q backend
.\venv\Scripts\python.exe -m pip check
Set-Location frontend
npm run lint
npm run build
```
