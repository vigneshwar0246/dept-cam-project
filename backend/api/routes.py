from datetime import UTC, datetime
from typing import Annotated

import cv2
import torch
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from backend.api.dependencies import get_state
from backend.core.security import require_admin
from backend.schemas.models import CameraCreate, CameraUpdate, CorrectionRequest

router = APIRouter(prefix="/api")
Admin = Annotated[None, Depends(require_admin)]


def camera_or_404(container, camera_id: str):
    try:
        return container.camera_manager.get(camera_id)
    except KeyError:
        raise HTTPException(404, "Camera not found")


@router.get("/health")
async def health(container=Depends(get_state)):
    return {"status": "healthy", "timestamp": datetime.now(UTC), "database": "connected" if container.database.available else "development-memory"}


@router.get("/system/status")
async def system_status(container=Depends(get_state)):
    return {"model": container.model_loader.status(), "cuda_available": torch.cuda.is_available(), "cameras": len(container.camera_manager.list()), "database": container.database.available}


@router.get("/system/performance")
async def performance(container=Depends(get_state)):
    gpu = None
    if torch.cuda.is_available():
        gpu = {"name": torch.cuda.get_device_name(0), "allocated_mb": torch.cuda.memory_allocated(0) / 1024 ** 2, "reserved_mb": torch.cuda.memory_reserved(0) / 1024 ** 2}
    return {"cameras": container.performance.snapshot(), "gpu": gpu, "persistence_queue": container.repository.queue.qsize()}


@router.get("/cameras")
async def cameras(container=Depends(get_state)):
    return [container.camera_manager.public(item) for item in container.camera_manager.list()]


@router.post("/cameras", status_code=201)
async def create_camera(payload: CameraCreate, _: Admin, container=Depends(get_state)):
    try:
        camera = container.camera_manager.add(payload)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    await container.repository.save_camera(payload.model_dump(mode="json"))
    return container.camera_manager.public(camera)


@router.get("/cameras/{camera_id}")
async def get_camera(camera_id: str, container=Depends(get_state)):
    return container.camera_manager.public(camera_or_404(container, camera_id))


@router.put("/cameras/{camera_id}")
async def update_camera(camera_id: str, payload: CameraUpdate, _: Admin, container=Depends(get_state)):
    camera_or_404(container, camera_id)
    camera = container.camera_manager.update(camera_id, payload)
    await container.repository.save_camera(camera.config.model_dump(mode="json"))
    return container.camera_manager.public(camera)


@router.delete("/cameras/{camera_id}", status_code=204)
async def delete_camera(camera_id: str, _: Admin, container=Depends(get_state)):
    camera_or_404(container, camera_id)
    await container.camera_service.stop(camera_id)
    container.camera_manager.remove(camera_id)
    await container.repository.delete_camera(camera_id)
    return Response(status_code=204)


@router.post("/cameras/{camera_id}/start")
async def start_camera(camera_id: str, _: Admin, container=Depends(get_state)):
    camera_or_404(container, camera_id)
    container.camera_service.start(camera_id)
    return {"status": "starting", "camera_id": camera_id}


@router.post("/cameras/{camera_id}/stop")
async def stop_camera(camera_id: str, _: Admin, container=Depends(get_state)):
    camera_or_404(container, camera_id)
    await container.camera_service.stop(camera_id)
    return {"status": "stopped", "camera_id": camera_id}


@router.get("/cameras/{camera_id}/snapshot")
async def snapshot(camera_id: str, container=Depends(get_state)):
    item = camera_or_404(container, camera_id).frames.get(copy=True)
    if item is None:
        raise HTTPException(503, "No camera frame available")
    ok, image = cv2.imencode(".jpg", item[0], [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not ok:
        raise HTTPException(500, "Snapshot encoding failed")
    return Response(image.tobytes(), media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.get("/cameras/{camera_id}/config")
async def get_camera_config(camera_id: str, container=Depends(get_state)):
    return container.camera_manager.public(camera_or_404(container, camera_id))


@router.put("/cameras/{camera_id}/config")
async def update_camera_config(camera_id: str, payload: CameraUpdate, _: Admin, container=Depends(get_state)):
    camera_or_404(container, camera_id)
    camera = container.camera_manager.update(camera_id, payload)
    await container.repository.save_camera(camera.config.model_dump(mode="json"))
    return container.camera_manager.public(camera)


@router.get("/occupancy")
async def occupancy(container=Depends(get_state)):
    return container.occupancy_manager.all()


@router.get("/occupancy/history")
async def occupancy_history(zone_id: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), container=Depends(get_state)):
    return await container.repository.find("occupancy_snapshots", {"zone_id": zone_id} if zone_id else {}, (page - 1) * page_size, page_size)


@router.get("/occupancy/{zone_id}")
async def zone_occupancy(zone_id: str, container=Depends(get_state)):
    return container.occupancy_manager.get(zone_id)


@router.post("/occupancy/{zone_id}/correction")
async def correction(zone_id: str, payload: CorrectionRequest, _: Admin, container=Depends(get_state)):
    return await container.occupancy_service.correction(zone_id, payload.occupancy, payload.reason, container.settings.admin_username)


@router.get("/events")
async def events(zone_id: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), container=Depends(get_state)):
    return await container.repository.find("occupancy_events", {"zone_id": zone_id} if zone_id else {}, (page - 1) * page_size, page_size)


@router.get("/events/summary")
async def event_summary(container=Depends(get_state)):
    return [{"zone_id": row["zone_id"], "entries": row["entries"], "exits": row["exits"]} for row in container.occupancy_manager.all()]


async def analytics(container, daily: bool):
    events = await container.repository.find("occupancy_events", {}, 0, 10000)
    buckets: dict[str, dict] = {}
    for event in events:
        timestamp = event["timestamp"]
        key = timestamp.strftime("%Y-%m-%d" if daily else "%Y-%m-%dT%H:00Z")
        bucket = buckets.setdefault(key, {"period": key, "entries": 0, "exits": 0})
        bucket[f"{event['event_type']}s"] += 1
    return sorted(buckets.values(), key=lambda item: item["period"])


@router.get("/analytics/daily")
async def daily(container=Depends(get_state)):
    return await analytics(container, True)


@router.get("/analytics/hourly")
async def hourly(container=Depends(get_state)):
    return await analytics(container, False)


@router.get("/analytics/peak-hours")
async def peak_hours(container=Depends(get_state)):
    data = await analytics(container, False)
    return sorted(data, key=lambda item: item["entries"] + item["exits"], reverse=True)[:10]
