# Phone camera pairing (QR + WebRTC)

The phone camera uses encrypted WebRTC media, not JPEG uploads. A short-lived QR pairing token authorizes signaling, then decoded frames are written to the same one-frame buffer used by laptop and RTSP cameras. The shared YOLO11n model, camera-specific ByteTrack state, line counter, MongoDB writer, WebSocket updates, and processed MJPEG preview are unchanged.

## 1. Find the laptop LAN address

In PowerShell:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object InterfaceAlias,IPAddress
```

The examples below use `192.168.1.10`. Replace it everywhere with the laptop address. Keep both devices on the same trusted Wi-Fi. Guest networks commonly block device-to-device traffic.

## 2. Install a trusted LAN certificate

Install [mkcert](https://github.com/FiloSottile/mkcert) on Windows, then create a locally trusted CA and a certificate containing both the LAN address and localhost:

```powershell
Set-Location D:\Department-Occupancy-Tracking
mkcert -install
New-Item -ItemType Directory -Force .certs
mkcert -cert-file .certs\lan.pem -key-file .certs\lan-key.pem 192.168.1.10 localhost 127.0.0.1
mkcert -CAROOT
```

`mkcert -install` trusts the CA on Windows only. Transfer the `rootCA.pem` shown by `mkcert -CAROOT` to the phone through a private channel:

- Android: Settings → Security/Encryption & credentials → Install a certificate → CA certificate. Android displays a network-monitoring warning for user CAs; remove the CA after testing if it is no longer needed.
- iPhone/iPad: open the CA file, install the downloaded profile in Settings → General → VPN & Device Management, then enable it in Settings → General → About → Certificate Trust Settings.

Do not continue through a browser certificate warning. An arbitrary self-signed certificate is not reliably accepted by `getUserMedia` on mobile browsers.

## 3. Configure environment variables

Backend `.env`:

```dotenv
HOST=0.0.0.0
CORS_ORIGINS=https://192.168.1.10:5173
PHONE_FRONTEND_URL=https://192.168.1.10:5173
PAIRING_TTL_SECONDS=120
PAIRING_ATTEMPTS_PER_MINUTE=30
WEBRTC_RECONNECT_GRACE_SECONDS=300
WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
WEBRTC_TURN_URLS=
WEBRTC_TURN_USERNAME=
WEBRTC_TURN_CREDENTIAL=
```

Frontend `frontend/.env.local`:

```dotenv
VITE_HOST=0.0.0.0
VITE_API_URL=https://192.168.1.10:8000/api
VITE_WS_URL=wss://192.168.1.10:8000
VITE_HTTPS_CERT=D:/Department-Occupancy-Tracking/.certs/lan.pem
VITE_HTTPS_KEY=D:/Department-Occupancy-Tracking/.certs/lan-key.pem
```

STUN helps discover NAT routes. Same-Wi-Fi connections normally use direct host candidates. For routed or restrictive networks, configure a TURN server using `WEBRTC_TURN_URLS` (for example `turns:turn.example.internal:5349`) and inject its username/credential through protected environment variables. TURN credentials are returned only after a valid one-time pairing token; they are not compiled into JavaScript or put in the QR URL. Use short-lived TURN credentials in production.

## 4. Start services

```powershell
Set-Location D:\Department-Occupancy-Tracking
.\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --ssl-certfile .certs\lan.pem --ssl-keyfile .certs\lan-key.pem
```

In a second PowerShell window:

```powershell
Set-Location D:\Department-Occupancy-Tracking\frontend
npm install
npm run dev
```

Allow only private-network inbound access when Windows prompts. If needed, run an elevated PowerShell:

```powershell
New-NetFirewallRule -DisplayName 'Occupancy HTTPS API (private LAN)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Private
New-NetFirewallRule -DisplayName 'Occupancy HTTPS UI (private LAN)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Private
```

Do not create router port-forwarding rules or expose these ports to the public internet.

## 5. Pair and verify

1. On the laptop, open `https://192.168.1.10:5173` and sign in.
2. Open Camera Management and select **Phone Camera** beside **Laptop Camera**.
3. Enter a stable camera ID, name, and zone; create the pairing session.
4. Scan the QR with Android Chrome or the iPhone Camera app/Safari within two minutes.
5. On the phone, tap **Start streaming** and grant camera access. The rear camera is preferred; use **Switch camera** when needed.
6. Wait until the laptop says **Camera connected**. This state is set only after the backend decodes and accepts its first frame.
7. Open Live Monitoring and verify the processed preview, detection boxes, anonymous ByteTrack IDs, counting line, receive FPS, processing FPS, and measured latency.
8. Walk across the calibrated line in both directions. Verify the occupancy WebSocket updates and query the `occupancy_events` collection in MongoDB.
9. Use **Stop** on the phone or **Disconnect phone** on the laptop to close tracks, the peer connection, processor, and camera state.

The 120-second timer applies only before the first phone claims the QR token. A claimed, active camera session has no automatic duration limit and may stream for hours. The dashboard and phone page show the live connection state, elapsed streaming duration, capture FPS, processing FPS, and measured backend latency.

If Wi-Fi drops temporarily, the phone reuses its existing permitted camera track and client identity while renegotiating with exponential backoff. The backend atomically replaces the old peer connection and retains the same processor, ByteTrack tracker, line counter, and frame buffer, preventing duplicate processing or occupancy events. `WEBRTC_RECONNECT_GRACE_SECONDS` controls how long an entirely interrupted connection may reconnect before the backend classifies it as permanently closed and frees resources. It is not an active-camera time limit.

Android Chrome and iPhone Safari both require explicit user interaction before camera permission. For multi-hour iPhone capture, keep Safari in the foreground, keep the phone powered, and disable Auto-Lock as appropriate for the controlled deployment. iOS may suspend browser camera capture when Safari is backgrounded or the screen locks; the application cannot bypass that operating-system behavior. Return to the page to let it reconnect, or create a new pairing if the reconnect grace period has elapsed.

## Troubleshooting

- **No camera permission:** confirm the address bar shows trusted HTTPS, then reset the site's Camera permission in browser settings.
- **QR opens localhost/wrong host:** correct `PHONE_FRONTEND_URL`, restart the backend, and create a new pairing.
- **API/network error:** visit `https://192.168.1.10:8000/api/health` on the phone, verify the certificate and Windows Private firewall rules.
- **ICE fails:** disable VPNs, confirm Wi-Fi client isolation is off, then configure a reachable TURN service.
- **Expired/used token:** create a new session. Tokens cannot claim a second phone client.
- **Stream stopped after exactly 120 seconds:** this is not expected; the QR deadline is ignored after the phone has claimed the session. Check server logs for ICE/network failures rather than increasing `PAIRING_TTL_SECONDS`.
- **WebRTC connected but no backend frame:** keep the phone page foregrounded and ensure the video track is enabled. The admin UI intentionally does not report Camera connected until a decoded frame arrives.
- **Preview missing:** confirm `/api/cameras/{camera-id}/stream` returns processed MJPEG after inference starts.

Hardware behavior, FPS, and end-to-end latency depend on the phone, browser, Wi-Fi, codec, GPU, resolution, and TURN route. Read actual values from Live Monitoring and `/api/system/performance`; the application does not fabricate them.
