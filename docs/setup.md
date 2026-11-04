# Setup

Use the existing CUDA environment; requirements intentionally do not install PyTorch.

```powershell
Set-Location D:\Department-Occupancy-Tracking
.\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item .env.example .env
notepad .env
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU fallback')"
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --ssl-certfile .certs\lan.pem --ssl-keyfile .certs\lan-key.pem
```

Set `DATABASE_URL=mongodb://127.0.0.1:27017` or an Atlas URI. For the current LAN, use `CORS_ORIGINS=https://192.168.1.6:5173` and always open `https://192.168.1.6:5173`, not localhost. Leave the database URL blank only for development/testing. Test with `pytest -q`; hardware checks are opt-in as shown in the README.
