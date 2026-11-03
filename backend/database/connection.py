import logging

from pymongo import AsyncMongoClient

from backend.core.config import Settings

logger = logging.getLogger(__name__)


class Database:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client: AsyncMongoClient | None = None
        self.db = None
        self.available = False

    async def connect(self) -> None:
        if not self.settings.database_enabled:
            logger.info("MongoDB disabled: development in-memory mode")
            return
        try:
            self.client = AsyncMongoClient(self.settings.effective_database_url, serverSelectionTimeoutMS=3000)
            await self.client.admin.command("ping")
            self.db = self.client[self.settings.database_name]
            await self._indexes()
            self.available = True
        except Exception:
            if self.settings.app_env == "production":
                raise
            logger.exception("MongoDB unavailable; continuing in development in-memory mode")

    async def _indexes(self) -> None:
        await self.db.cameras.create_index("id", unique=True)
        await self.db.occupancy_events.create_index([("zone_id", 1), ("timestamp", -1)])
        await self.db.occupancy_events.create_index([("camera_id", 1), ("timestamp", -1)])
        await self.db.occupancy_snapshots.create_index([("zone_id", 1), ("timestamp", -1)])
        await self.db.occupancy_corrections.create_index([("zone_id", 1), ("timestamp", -1)])

    async def close(self) -> None:
        if self.client:
            await self.client.close()

