from backend.detection.person_detector import Detection, PersonDetector


class PersonTracker(PersonDetector):
    """Ultralytics ByteTrack-backed person tracker."""

