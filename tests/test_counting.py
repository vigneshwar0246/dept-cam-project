from unittest.mock import patch

from backend.counting.line_counter import LineCounter
from backend.counting.occupancy_manager import OccupancyManager
from backend.schemas.models import LineConfig, Point


def counter():
    return LineCounter(LineConfig(start=Point(x=0, y=0.5), end=Point(x=1, y=0.5), enter_side="positive", cooldown_seconds=2))


def test_entry_and_exit_crossings():
    item = counter()
    assert item.update(1, (50, 40), (100, 100)) is None
    assert item.update(1, (50, 60), (100, 100)).event_type == "enter"
    with patch("backend.counting.line_counter.monotonic", return_value=100):
        item._crossed_at[1] = 0
        assert item.update(1, (50, 40), (100, 100)).event_type == "exit"


def test_duplicate_crossing_prevention():
    item = counter()
    item.update(2, (50, 40), (100, 100))
    assert item.update(2, (50, 60), (100, 100)) is not None
    assert item.update(2, (50, 40), (100, 100)) is None


def test_occupancy_increment_decrement_and_floor():
    manager = OccupancyManager()
    assert manager.apply("dept", "enter")["occupancy"] == 1
    assert manager.apply("dept", "exit")["occupancy"] == 0
    assert manager.apply("dept", "exit")["occupancy"] == 0


def test_manual_correction():
    manager = OccupancyManager()
    state, previous = manager.correct("dept", 12)
    assert previous == 0 and state["occupancy"] == 12

