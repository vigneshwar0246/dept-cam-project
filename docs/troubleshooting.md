# Troubleshooting

- MongoDB: confirm the service is running and check `DATABASE_URL` and `DATABASE_NAME`.
- Frontend offline: open `https://192.168.1.6:8000/api/health`, verify `frontend/.env`, and confirm `CORS_ORIGINS=https://192.168.1.6:5173`. Open the UI through that same LAN origin, not localhost.
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
