@echo off
setlocal EnableExtensions
title Department Occupancy Tracking - Launcher

cd /d "%~dp0"
set "PROJECT_ROOT=%CD%"
set "PYTHON=%PROJECT_ROOT%\venv\Scripts\python.exe"
set "CERT_FILE=%PROJECT_ROOT%\.certs\lan.pem"
set "KEY_FILE=%PROJECT_ROOT%\.certs\lan-key.pem"
set "APP_URL=https://localhost:5173"

echo ============================================================
echo   Department Occupancy Tracking
echo ============================================================
echo.

if not exist ".env" (call :fail "Missing .env. Copy .env.example to .env and configure it first." & exit /b 1)
if not exist "%PYTHON%" (call :fail "Missing Python environment: venv\Scripts\python.exe" & exit /b 1)
if not exist "frontend\package.json" (call :fail "Missing frontend\package.json" & exit /b 1)
if not exist "frontend\node_modules" (call :fail "Frontend packages are missing. Run: cd frontend ^&^& npm install" & exit /b 1)
if not exist "%CERT_FILE%" (call :fail "Missing HTTPS certificate: .certs\lan.pem" & exit /b 1)
if not exist "%KEY_FILE%" (call :fail "Missing HTTPS private key: .certs\lan-key.pem" & exit /b 1)

where npm.cmd >nul 2>&1 || (call :fail "npm was not found. Install Node.js and reopen this file." & exit /b 1)

if not exist "frontend\.env" (
    if not exist "frontend\.env.example" (call :fail "Missing frontend\.env and frontend\.env.example" & exit /b 1)
    copy /y "frontend\.env.example" "frontend\.env" >nul
    echo [SETUP] Created frontend\.env from frontend\.env.example
)

for /f "tokens=1,* delims==" %%A in ('findstr /b /i "PHONE_FRONTEND_URL=" ".env"') do set "APP_URL=%%B"

echo [CHECK] Testing the MongoDB connection configured in .env...
"%PYTHON%" -c "from pymongo import MongoClient; from backend.core.config import Settings; s=Settings(); uri=s.effective_database_url; assert uri, 'DATABASE_URL is empty in .env'; c=MongoClient(uri, serverSelectionTimeoutMS=5000); c.admin.command('ping'); c.close(); print('MongoDB is connected.')"
if errorlevel 1 (call :fail "MongoDB is not reachable. Start/connect MongoDB, verify DATABASE_URL in .env, then try again." & exit /b 1)

powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 8000,5173 -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (call :fail "Port 8000 or 5173 is already in use. Close the previous app windows, then try again." & exit /b 1)

echo [START] Opening backend...
start "Occupancy Backend" /D "%PROJECT_ROOT%" cmd.exe /k ""%PYTHON%" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --ssl-certfile "%CERT_FILE%" --ssl-keyfile "%KEY_FILE%""

echo [WAIT] Waiting for the backend health check...
set "BACKEND_READY="
for /l %%I in (1,1,30) do (
    curl.exe --silent --insecure --fail "https://127.0.0.1:8000/api/health" >nul 2>&1 && set "BACKEND_READY=1" && goto backend_ready
    timeout /t 1 /nobreak >nul
)

:backend_ready
if not defined BACKEND_READY (call :fail "Backend did not become ready. Read the Occupancy Backend window for the error." & exit /b 1)

echo [START] Opening frontend...
start "Occupancy Frontend" /D "%PROJECT_ROOT%\frontend" cmd.exe /k "npm.cmd run dev"

echo [WAIT] Waiting for the frontend...
set "FRONTEND_READY="
for /l %%I in (1,1,30) do (
    curl.exe --silent --insecure --fail "https://127.0.0.1:5173" >nul 2>&1 && set "FRONTEND_READY=1" && goto frontend_ready
    timeout /t 1 /nobreak >nul
)

:frontend_ready
if not defined FRONTEND_READY (call :fail "Frontend did not become ready. Read the Occupancy Frontend window for the error." & exit /b 1)

echo.
echo [READY] Backend and frontend are running.
echo [OPEN]  %APP_URL%
start "" "%APP_URL%"
echo.
echo Keep the Backend and Frontend windows open while using the app.
timeout /t 5 /nobreak >nul
exit /b 0

:fail
echo.
echo [ERROR] %~1
echo.
pause
exit /b 1
