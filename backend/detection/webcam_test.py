import cv2
import time
from ultralytics import YOLO

# Configuration
MODEL_PATH = "yolo11n.pt"
CAMERA_INDEX = 0
CONFIDENCE = 0.35
IMAGE_SIZE = 640

print("Loading YOLO11n on NVIDIA GPU...")
model = YOLO(MODEL_PATH)
model.to("cuda:0")

print("Opening laptop webcam...")
camera = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not camera.isOpened():
    print("ERROR: Could not open webcam.")
    print("Check camera permissions or try CAMERA_INDEX = 1.")
    raise SystemExit(1)

print("Webcam started. Press Q to quit.")

previous_time = time.perf_counter()
fps = 0.0

try:
    while True:
        success, frame = camera.read()

        if not success:
            print("Could not read frame from webcam.")
            break

        # Detect people only (COCO class 0)
        results = model.predict(
            source=frame,
            device="cuda:0",
            imgsz=IMAGE_SIZE,
            classes=[0],
            conf=CONFIDENCE,
            half=True,
            verbose=False
        )

        # Draw bounding boxes
        output = results[0].plot()

        # Calculate FPS
        current_time = time.perf_counter()
        elapsed = current_time - previous_time
        previous_time = current_time

        if elapsed > 0:
            instant_fps = 1.0 / elapsed
            fps = instant_fps if fps == 0 else 0.8 * fps + 0.2 * instant_fps

        person_count = len(results[0].boxes)

        cv2.putText(
            output,
            f"People detected: {person_count}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2
        )

        cv2.putText(
            output,
            f"FPS: {fps:.1f} | GPU: RTX 3050",
            (20, 75),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2
        )

        cv2.imshow("Department Occupancy - Webcam Test", output)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    camera.release()
    cv2.destroyAllWindows()
    print("Webcam stopped safely.")
