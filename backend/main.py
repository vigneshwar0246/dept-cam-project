import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.routes import router
from backend.api.websocket import WebSocketHub
from backend.camera.camera_manager import CameraManager
from backend.core.config import Settings, get_settings
from backend.core.logging_config import configure_logging
from backend.counting.occupancy_manager import OccupancyManager
from backend.database.connection import Database
from backend.database.repository import Repository
from backend.detection.model_loader import ModelLoader
from backend.detection.person_detector import PersonDetector
from backend.services.camera_service import CameraService
from backend.services.pairing_service import PairingService
from backend.services.occupancy_service import OccupancyService
from backend.utils.performance_monitor import PerformanceMonitor
from backend.schemas.models import CameraCreate


@dataclass
class Container:
    settings: Settings
    database: Database
    repository: Repository
    camera_manager: CameraManager
    occupancy_manager: OccupancyManager
    occupancy_service: OccupancyService
    camera_service: CameraService
    model_loader: ModelLoader
    performance: PerformanceMonitor
    hub: WebSocketHub
    pairing_service: PairingService | None = None


def build_container(settings: Settings) -> Container:
    database = Database(settings)
    repository = Repository(database, settings.persistence_queue_size)
    cameras, occupancy, hub, performance = CameraManager(), OccupancyManager(), WebSocketHub(), PerformanceMonitor()
    loader = ModelLoader(settings)
    occupancy_service = OccupancyService(occupancy, repository, hub)
    camera_service = CameraService(cameras, PersonDetector(loader, settings), occupancy_service, performance, settings)
    container = Container(settings, database, repository, cameras, occupancy, occupancy_service, camera_service, loader, performance, hub)
    container.pairing_service = PairingService(container)
    return container


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    container = build_container(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await container.database.connect()
        container.pairing_service.start()
        container.repository.start()
        for row in await container.repository.cameras():
            try:
                container.camera_manager.add(CameraCreate.model_validate(row))
            except ValueError:
                pass
        for row in await container.repository.latest_snapshots():
            container.occupancy_manager.restore(row["zone_id"], row["occupancy"], row.get("entries", 0), row.get("exits", 0))

        async def snapshots():
            while True:
                await asyncio.sleep(settings.occupancy_snapshot_interval)
                container.occupancy_service.snapshot()

        snapshot_task = asyncio.create_task(snapshots())
        yield
        snapshot_task.cancel()
        await container.camera_service.stop_all()
        await container.pairing_service.close()
        container.occupancy_service.snapshot()
        await container.repository.close()
        await container.database.close()

    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    app.state.container = container
    app.add_middleware(CORSMiddleware, allow_origins=[value.strip() for value in settings.cors_origins.split(",")], allow_methods=["*"], allow_headers=["*"])
    app.include_router(router)

    @app.exception_handler(Exception)
    async def internal_error(_: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    @app.websocket("/ws/occupancy")
    async def occupancy_ws(websocket: WebSocket):
        await container.hub.connect(websocket)
        try:
            while True:
                await websocket.send_json({"type": "heartbeat", "occupancy": container.occupancy_manager.all()})
                try:
                    await asyncio.wait_for(websocket.receive_text(), timeout=settings.websocket_update_interval)
                except asyncio.TimeoutError:
                    continue
        except WebSocketDisconnect:
            container.hub.disconnect(websocket)

    @app.websocket("/ws/cameras/{camera_id}")
    async def camera_ws(websocket: WebSocket, camera_id: str):
        if camera_id not in {item.config.id for item in container.camera_manager.list()}:
            await websocket.close(code=4404)
            return
        await container.hub.connect(websocket, camera_id)
        try:
            while True:
                camera = container.camera_manager.get(camera_id)
                await websocket.send_json({"type": "heartbeat", "camera_id": camera_id, "status": camera.status})
                try:
                    await asyncio.wait_for(websocket.receive_text(), timeout=settings.websocket_update_interval)
                except asyncio.TimeoutError:
                    continue
        except WebSocketDisconnect:
            container.hub.disconnect(websocket, camera_id)

    return app


app = create_app()
