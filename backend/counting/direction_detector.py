def signed_side(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
    return (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])

