import asyncio
import hashlib
import secrets
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from time import monotonic
from uuid import uuid4

from aiortc import RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCSessionDescription
from aiortc.sdp import candidate_from_sdp
from fastapi import HTTPException

from backend.camera.mobile_camera import MobileCamera
from backend.schemas.models import CameraCreate, CameraType, CameraUpdate, ICECandidate, PairingCreate, WebRTCOffer


@dataclass
class PairingSession:
    id: str
    token_hash: bytes
    camera_id: str
    expires_at: datetime
    status: str = "waiting_for_phone"
    client_id: str | None = None
    peer: RTCPeerConnection | None = None
    frame_task: asyncio.Task | None = None
    first_frame_at: datetime | None = None
    claimed_at: datetime | None = None
    interrupted_at: datetime | None = None
    terminal_at: datetime | None = None
    negotiation_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class PairingService:
    def __init__(self, container) -> None:
        self.container = container
        self.sessions: dict[str, PairingSession] = {}
        self.attempts: dict[str, deque[float]] = defaultdict(deque)
        self._cleanup_task: asyncio.Task | None = None

    def start(self) -> None:
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def close(self) -> None:
        if self._cleanup_task:
            self._cleanup_task.cancel()
            await asyncio.gather(self._cleanup_task, return_exceptions=True)
        await asyncio.gather(*(self._close_peer(item) for item in list(self.sessions.values())), return_exceptions=True)

    async def create(self, payload: PairingCreate) -> dict:
        try:
            camera = self.container.camera_manager.get(payload.camera_id)
            if camera.config.type != CameraType.MOBILE or not str(camera.config.source).startswith("webrtc://"):
                raise HTTPException(409, "Camera ID is already used by a non-paired camera")
            await self.container.camera_service.stop(payload.camera_id)
            camera = self.container.camera_manager.update(payload.camera_id, CameraUpdate(name=payload.camera_name, zone_id=payload.zone_id, width=payload.width, height=payload.height, fps=payload.fps))
            await self.container.repository.save_camera(camera.config.model_dump(mode="json"))
        except KeyError:
            config = CameraCreate(id=payload.camera_id, name=payload.camera_name, type=CameraType.MOBILE, zone_id=payload.zone_id, source=f"webrtc://{payload.camera_id}", width=payload.width, height=payload.height, fps=payload.fps)
            camera = self.container.camera_manager.add(config)
            await self.container.repository.save_camera(config.model_dump(mode="json"))
        for old in list(self.sessions.values()):
            if old.camera_id == payload.camera_id:
                await self.cancel(old.id)
        token = secrets.token_urlsafe(32)
        session = PairingSession(str(uuid4()), self._hash(token), payload.camera_id, datetime.now(UTC) + timedelta(seconds=self.container.settings.pairing_ttl_seconds))
        self.sessions[session.id] = session
        self.container.camera_service.start(camera.config.id)
        base = self.container.settings.phone_frontend_url.rstrip("/")
        return {**self.public(session), "pairing_url": f"{base}/mobile-camera/{session.id}#token={token}"}

    def authenticate(self, session_id: str, token: str, source: str) -> PairingSession:
        session = self.sessions.get(session_id)
        if not session or not secrets.compare_digest(session.token_hash, self._hash(token)):
            self._rate_limit(source)
            raise HTTPException(401, "Invalid pairing session")
        if datetime.now(UTC) >= session.expires_at and session.client_id is None:
            session.status = "expired"
            raise HTTPException(410, "Pairing session expired")
        if session.status in {"cancelled", "disconnected"}:
            raise HTTPException(410, f"Pairing session {session.status}")
        return session

    async def offer(self, session: PairingSession, payload: WebRTCOffer) -> dict:
        async with session.negotiation_lock:
            if session.client_id and session.client_id != payload.client_id:
                raise HTTPException(409, "Pairing token has already been claimed")
            if session.status in {"cancelled", "disconnected", "permanently_closed"}:
                raise HTTPException(410, f"Pairing session {session.status}")
            if session.client_id is None:
                session.client_id = payload.client_id
                session.claimed_at = datetime.now(UTC)
            await self._close_peer(session)
            self.container.camera_service.start(session.camera_id)
            peer = RTCPeerConnection(self._rtc_configuration())
            session.peer = peer
            session.interrupted_at = None
            session.status = "establishing_webrtc"

            @peer.on("track")
            def on_track(track):
                if track.kind != "video" or session.peer is not peer:
                    return
                session.status = "receiving_video"
                session.frame_task = asyncio.create_task(self._receive_frames(session, track, peer))

            @peer.on("connectionstatechange")
            async def on_connection_state_change():
                if session.peer is not peer:
                    return
                if peer.connectionState == "connected":
                    session.interrupted_at = None
                    if session.first_frame_at:
                        session.status = "camera_connected"
                elif peer.connectionState in {"failed", "closed", "disconnected"}:
                    camera = self.container.camera_manager.get(session.camera_id)
                    if isinstance(camera, MobileCamera):
                        camera.interrupted()
                    if session.status not in {"cancelled", "disconnected", "permanently_closed"}:
                        session.interrupted_at = session.interrupted_at or datetime.now(UTC)
                        session.status = "reconnecting"

            await peer.setRemoteDescription(RTCSessionDescription(sdp=payload.sdp, type=payload.type))
            answer = await peer.createAnswer()
            await peer.setLocalDescription(answer)
            return {"sdp": peer.localDescription.sdp, "type": peer.localDescription.type}

    async def add_candidate(self, session: PairingSession, payload: ICECandidate) -> None:
        if session.client_id != payload.client_id or not session.peer:
            raise HTTPException(409, "No active negotiation for this client")
        if not payload.candidate:
            await session.peer.addIceCandidate(None)
            return
        candidate = candidate_from_sdp(payload.candidate.removeprefix("candidate:"))
        candidate.sdpMid = payload.sdp_mid
        candidate.sdpMLineIndex = payload.sdp_mline_index
        await session.peer.addIceCandidate(candidate)

    async def cancel(self, session_id: str, disconnected: bool = False) -> None:
        session = self.sessions.get(session_id)
        if not session:
            return
        session.status = "disconnected" if disconnected else "cancelled"
        session.interrupted_at = None
        session.terminal_at = datetime.now(UTC)
        await self._close_peer(session)
        try:
            await self.container.camera_service.stop(session.camera_id)
        except KeyError:
            pass

    def public(self, session: PairingSession) -> dict:
        camera = self.container.camera_manager.get(session.camera_id)
        health = camera.health()
        performance = self.container.performance.snapshot().get(session.camera_id, {})
        return {
            "id": session.id,
            "camera_id": session.camera_id,
            "status": session.status,
            "expires_at": session.expires_at.isoformat(),
            "claimed_at": session.claimed_at.isoformat() if session.claimed_at else None,
            "first_frame_at": session.first_frame_at.isoformat() if session.first_frame_at else None,
            "streaming_duration_seconds": health.get("streaming_duration_seconds", 0),
            "capture_fps": health.get("capture_fps", 0),
            "processing_fps": performance.get("processing_fps", 0),
            "latency_ms": performance.get("average_total_latency_ms", 0),
        }

    def ice_servers(self) -> list[dict]:
        settings = self.container.settings
        result = [{"urls": [value.strip() for value in settings.webrtc_stun_urls.split(",") if value.strip()]}] if settings.webrtc_stun_urls.strip() else []
        if settings.webrtc_turn_urls.strip():
            result.append({"urls": [value.strip() for value in settings.webrtc_turn_urls.split(",") if value.strip()], "username": settings.webrtc_turn_username, "credential": settings.webrtc_turn_credential})
        return result

    async def _receive_frames(self, session: PairingSession, track, peer: RTCPeerConnection) -> None:
        camera = self.container.camera_manager.get(session.camera_id)
        try:
            while True:
                frame = await track.recv()
                camera.receive(frame.to_ndarray(format="bgr24"))
                if session.first_frame_at is None:
                    session.first_frame_at = datetime.now(UTC)
                if session.peer is peer:
                    session.interrupted_at = None
                    session.status = "camera_connected"
        except asyncio.CancelledError:
            raise
        except Exception:
            camera.interrupted()
            if session.peer is peer and session.status not in {"cancelled", "disconnected", "permanently_closed"}:
                session.interrupted_at = session.interrupted_at or datetime.now(UTC)
                session.status = "reconnecting"

    async def _close_peer(self, session: PairingSession) -> None:
        if session.frame_task and session.frame_task is not asyncio.current_task():
            session.frame_task.cancel()
            await asyncio.gather(session.frame_task, return_exceptions=True)
        session.frame_task = None
        peer, session.peer = session.peer, None
        if peer:
            await peer.close()

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(5)
            await self._cleanup_once(datetime.now(UTC))

    async def _cleanup_once(self, now: datetime) -> None:
        for session in list(self.sessions.values()):
            if now >= session.expires_at and session.client_id is None and session.status not in {"expired", "cancelled", "disconnected"}:
                session.status = "expired"
                session.terminal_at = now
                await self._close_peer(session)
                await self.container.camera_service.stop(session.camera_id)
            elif session.interrupted_at and (now - session.interrupted_at).total_seconds() >= self.container.settings.webrtc_reconnect_grace_seconds:
                session.status = "permanently_closed"
                session.interrupted_at = None
                session.terminal_at = now
                await self._close_peer(session)
                await self.container.camera_service.stop(session.camera_id)
            if session.terminal_at and (now - session.terminal_at).total_seconds() >= 300:
                self.sessions.pop(session.id, None)

    def _rate_limit(self, source: str) -> None:
        now = monotonic()
        bucket = self.attempts[source]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= self.container.settings.pairing_attempts_per_minute:
            raise HTTPException(429, "Too many pairing attempts")
        bucket.append(now)

    def _rtc_configuration(self) -> RTCConfiguration:
        return RTCConfiguration([RTCIceServer(**server) for server in self.ice_servers()])

    @staticmethod
    def _hash(token: str) -> bytes:
        return hashlib.sha256(token.encode()).digest()
