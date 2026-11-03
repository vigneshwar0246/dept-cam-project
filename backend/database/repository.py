import asyncio
import logging
from datetime import UTC, datetime, timedelta

from backend.database.connection import Database

logger = logging.getLogger(__name__)


class Repository:
    def __init__(self, database: Database, queue_size: int = 1000) -> None:
        self.database = database
        self.queue: asyncio.Queue[tuple[str, dict]] = asyncio.Queue(maxsize=queue_size)
        self._worker: asyncio.Task | None = None
        self.memory: dict[str, list[dict]] = {"occupancy_events": [], "occupancy_snapshots": [], "occupancy_corrections": []}
        self.memory_cameras: dict[str, dict] = {}

    def start(self) -> None:
        self._worker = asyncio.create_task(self._run())

    async def close(self) -> None:
        await self.queue.join()
        if self._worker:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass

    def enqueue(self, collection: str, document: dict) -> bool:
        document = {**document, "timestamp": document.get("timestamp", datetime.now(UTC))}
        try:
            self.queue.put_nowait((collection, document))
            return True
        except asyncio.QueueFull:
            logger.error("Persistence queue full; dropping %s document", collection)
            return False

    async def _run(self) -> None:
        while True:
            collection, document = await self.queue.get()
            try:
                if self.database.available:
                    await self.database.db[collection].insert_one(document)
                else:
                    self.memory.setdefault(collection, []).append(document)
            except Exception:
                logger.exception("Failed to persist %s", collection)
            finally:
                self.queue.task_done()

    async def find(self, collection: str, query: dict, skip: int, limit: int, sort="timestamp") -> list[dict]:
        if self.database.available:
            rows = await self.database.db[collection].find(query, {"_id": 0}).sort(sort, -1).skip(skip).limit(limit).to_list()
        else:
            rows = list(self.memory.get(collection, []))
            if query.get("zone_id"):
                rows = [row for row in rows if row.get("zone_id") == query["zone_id"]]
            rows = sorted(rows, key=lambda item: item.get(sort, datetime.min.replace(tzinfo=UTC)), reverse=True)[skip:skip + limit]
        return rows

    async def latest_snapshots(self) -> list[dict]:
        if self.database.available:
            pipeline = [{"$sort": {"timestamp": -1}}, {"$group": {"_id": "$zone_id", "doc": {"$first": "$$ROOT"}}}]
            cursor = await self.database.db.occupancy_snapshots.aggregate(pipeline)
            return [item["doc"] async for item in cursor]
        latest: dict[str, dict] = {}
        for row in self.memory["occupancy_snapshots"]:
            latest[row["zone_id"]] = row
        return list(latest.values())

    async def save_camera(self, document: dict) -> None:
        if self.database.available:
            await self.database.db.cameras.replace_one({"id": document["id"]}, document, upsert=True)
        else:
            self.memory_cameras[document["id"]] = document

    async def delete_camera(self, camera_id: str) -> None:
        if self.database.available:
            await self.database.db.cameras.delete_one({"id": camera_id})
        else:
            self.memory_cameras.pop(camera_id, None)

    async def cameras(self) -> list[dict]:
        if self.database.available:
            return await self.database.db.cameras.find({}, {"_id": 0}).to_list()
        return list(self.memory_cameras.values())

