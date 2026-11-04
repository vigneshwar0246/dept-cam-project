from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse, parse_qs

from fastapi.testclient import TestClient

from backend.core.config import Settings
from backend.main import create_app


def make_client():
    settings = Settings(app_env="test", database_url=None, mongodb_uri=None, api_auth_secret="test-key", phone_frontend_url="https://192.168.1.20:5173", pairing_ttl_seconds=120, _env_file=None)
    return TestClient(create_app(settings))


def create_pairing(client):
    return client.post("/api/phone-pairings", headers={"X-API-Key": "test-key"}, json={"camera_id": "phone-door", "camera_name": "Door phone", "zone_id": "dept"})


def token_from(response):
    return parse_qs(urlparse(response.json()["pairing_url"]).fragment)["token"][0]


def test_pairing_creation_is_admin_only_and_uses_secret_token():
    with make_client() as client:
        assert create_pairing(client).status_code == 201
        unauthorized = client.post("/api/phone-pairings", json={"camera_id": "other", "camera_name": "Other", "zone_id": "dept"})
        assert unauthorized.status_code == 401
        response = create_pairing(client)
        body = response.json()
        token = token_from(response)
        assert len(token) >= 40
        assert token not in repr(client.app.state.container.pairing_service.sessions[body["id"]])
        assert body["pairing_url"].startswith("https://192.168.1.20:5173/mobile-camera/")


def test_pairing_rejects_bad_and_expired_tokens_and_cancels():
    with make_client() as client:
        response = create_pairing(client)
        session_id, token = response.json()["id"], token_from(response)
        url = f"/api/phone-pairings/{session_id}"
        assert client.get(url, headers={"Authorization": f"Bearer {token}"}).status_code == 200
        assert client.get(url, headers={"Authorization": "Bearer wrong"}).status_code == 401
        session = client.app.state.container.pairing_service.sessions[session_id]
        session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        assert client.get(url, headers={"Authorization": f"Bearer {token}"}).status_code == 410
        assert client.post(f"{url}/cancel", headers={"X-API-Key": "test-key"}).json()["status"] == "cancelled"


def test_claimed_session_has_no_time_based_expiry():
    with make_client() as client:
        response = create_pairing(client)
        session_id, token = response.json()["id"], token_from(response)
        session = client.app.state.container.pairing_service.sessions[session_id]
        session.client_id = "same-phone-client-1234"
        session.claimed_at = datetime.now(UTC) - timedelta(hours=8)
        session.expires_at = datetime.now(UTC) - timedelta(hours=8)
        camera = client.app.state.container.camera_manager.get("phone-door")
        import numpy as np
        camera.receive(np.zeros((120, 160, 3), dtype=np.uint8))
        camera._streaming_started_monotonic -= 8 * 3600
        result = client.get(f"/api/phone-pairings/{session_id}", headers={"Authorization": f"Bearer {token}"})
        assert result.status_code == 200
        assert result.json()["claimed_at"] is not None
        assert result.json()["streaming_duration_seconds"] >= 8 * 3600


def test_webrtc_mobile_frame_enters_latest_frame_buffer():
    import numpy as np

    with make_client() as client:
        response = create_pairing(client)
        camera = client.app.state.container.camera_manager.get(response.json()["camera_id"])
        camera.receive(np.zeros((120, 160, 3), dtype=np.uint8))
        frame = camera.frames.get()
        assert frame is not None and frame[0].shape == (120, 160, 3)
        assert camera.status == "running"


def test_manual_disconnect_stops_processor_and_camera():
    with make_client() as client:
        response = create_pairing(client)
        session_id, token = response.json()["id"], token_from(response)
        container = client.app.state.container
        assert "phone-door" in container.camera_service.processors
        result = client.post(f"/api/phone-pairings/{session_id}/disconnect", headers={"Authorization": f"Bearer {token}"})
        assert result.status_code == 200
        assert "phone-door" not in container.camera_service.processors
        assert container.camera_manager.get("phone-door").status == "stopped"
        assert container.camera_manager.get("phone-door").processing_status == "idle"
        assert container.pairing_service.sessions[session_id].peer is None


def test_permanently_interrupted_session_is_cleaned_up():
    with make_client() as client:
        response = create_pairing(client)
        container = client.app.state.container
        session = container.pairing_service.sessions[response.json()["id"]]
        session.client_id = "same-phone-client-1234"
        session.interrupted_at = datetime.now(UTC) - timedelta(seconds=container.settings.webrtc_reconnect_grace_seconds + 1)
        client.portal.call(container.pairing_service._cleanup_once, datetime.now(UTC))
        assert session.status == "permanently_closed"
        assert session.camera_id not in container.camera_service.processors


def test_terminal_pairing_session_is_removed_after_retention_window():
    with make_client() as client:
        response = create_pairing(client)
        container = client.app.state.container
        session = container.pairing_service.sessions[response.json()["id"]]
        client.portal.call(container.pairing_service.cancel, session.id, True)
        session.terminal_at = datetime.now(UTC) - timedelta(seconds=301)
        client.portal.call(container.pairing_service._cleanup_once, datetime.now(UTC))
        assert session.id not in container.pairing_service.sessions


def test_real_webrtc_video_reaches_shared_processing_pipeline():
    import asyncio
    import fractions
    import numpy as np
    from aiortc import MediaStreamTrack, RTCConfiguration, RTCPeerConnection, RTCSessionDescription
    from av import VideoFrame
    from unittest.mock import MagicMock

    from backend.main import build_container
    from backend.schemas.models import PairingCreate, WebRTCOffer

    class TestVideoTrack(MediaStreamTrack):
        kind = "video"

        def __init__(self):
            super().__init__()
            self.pts = 0

        async def recv(self):
            await asyncio.sleep(1 / 30)
            self.pts += 3000
            frame = VideoFrame.from_ndarray(np.zeros((120, 160, 3), dtype=np.uint8), format="bgr24")
            frame.pts = self.pts
            frame.time_base = fractions.Fraction(1, 90000)
            return frame

    async def run():
        settings = Settings(app_env="test", database_url=None, mongodb_uri=None, api_auth_secret="test-key", webrtc_stun_urls="", inference_fps=30, _env_file=None)
        container = build_container(settings)
        container.repository.start()
        container.camera_service.detector.track = MagicMock(return_value=([], 0.1))
        created = await container.pairing_service.create(PairingCreate(camera_id="rtc-phone", camera_name="RTC phone", zone_id="dept", width=160, height=120, fps=30))
        session = container.pairing_service.sessions[created["id"]]
        client = RTCPeerConnection(RTCConfiguration([]))
        client.addTrack(TestVideoTrack())
        offer = await client.createOffer()
        await client.setLocalDescription(offer)
        answer = await container.pairing_service.offer(session, WebRTCOffer(sdp=client.localDescription.sdp, client_id="client-identifier-1234"))
        await client.setRemoteDescription(RTCSessionDescription(**answer))
        camera = container.camera_manager.get("rtc-phone")
        for _ in range(100):
            if session.first_frame_at and camera.preview_frames.get():
                break
            await asyncio.sleep(0.05)
        assert session.status == "camera_connected"
        assert camera.frames.get() is not None
        assert camera.preview_frames.get() is not None
        assert camera.processing_status == "active"
        processor = container.camera_service.processors["rtc-phone"]
        reconnecting_client = RTCPeerConnection(RTCConfiguration([]))
        reconnecting_client.addTrack(TestVideoTrack())
        reconnect_offer = await reconnecting_client.createOffer()
        await reconnecting_client.setLocalDescription(reconnect_offer)
        reconnect_answer = await container.pairing_service.offer(session, WebRTCOffer(sdp=reconnecting_client.localDescription.sdp, client_id="client-identifier-1234"))
        await reconnecting_client.setRemoteDescription(RTCSessionDescription(**reconnect_answer))
        for _ in range(100):
            if session.status == "camera_connected":
                break
            await asyncio.sleep(0.05)
        assert container.camera_service.processors == {"rtc-phone": processor}
        assert session.status == "camera_connected"
        await client.close()
        await reconnecting_client.close()
        await container.pairing_service.close()
        await container.camera_service.stop_all()
        await container.repository.close()

    asyncio.run(run())
