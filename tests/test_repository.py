import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

from backend.database.repository import Repository


class AsyncCursor:
    def __init__(self, rows):
        self._iterator = iter(rows)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration


def mongo_repository(rows):
    aggregate = AsyncMock(return_value=AsyncCursor([{"doc": row} for row in rows]))
    database = SimpleNamespace(
        available=True,
        db=SimpleNamespace(occupancy_snapshots=SimpleNamespace(aggregate=aggregate)),
    )
    return Repository(database), aggregate


def test_latest_snapshots_returns_latest_snapshot_for_each_zone():
    now = datetime.now(UTC)
    latest_a = {"zone_id": "a", "occupancy": 2, "timestamp": now}
    latest_b = {"zone_id": "b", "occupancy": 5, "timestamp": now - timedelta(seconds=1)}
    repository, aggregate = mongo_repository([latest_a, latest_b])

    assert asyncio.run(repository.latest_snapshots()) == [latest_a, latest_b]
    aggregate.assert_awaited_once()
    pipeline = aggregate.await_args.args[0]
    assert pipeline == [
        {"$sort": {"timestamp": -1}},
        {"$group": {"_id": "$zone_id", "doc": {"$first": "$$ROOT"}}},
    ]


def test_latest_snapshots_returns_empty_list_for_empty_collection():
    repository, aggregate = mongo_repository([])

    assert asyncio.run(repository.latest_snapshots()) == []
    aggregate.assert_awaited_once()


def test_latest_snapshots_uses_latest_in_memory_snapshot_per_zone():
    database = SimpleNamespace(available=False)
    repository = Repository(database)
    repository.memory["occupancy_snapshots"] = [
        {"zone_id": "a", "occupancy": 1},
        {"zone_id": "b", "occupancy": 3},
        {"zone_id": "a", "occupancy": 2},
    ]

    snapshots = asyncio.run(repository.latest_snapshots())
    assert repository.memory["occupancy_snapshots"][-1] in snapshots
    assert {row["zone_id"]: row["occupancy"] for row in snapshots} == {"a": 2, "b": 3}
