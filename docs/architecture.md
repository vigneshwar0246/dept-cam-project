# Architecture

Each camera owns a capture thread and a one-frame `LatestFrameBuffer`, so slow inference drops stale frames. `CameraService` runs an async processor per camera. One reusable YOLO11n model performs person-only inference through Ultralytics ByteTrack. The bottom-center of each tracked box feeds an independent normalized virtual-line state machine.

Confirmed crossings update the in-memory per-zone counter, enter a bounded persistence queue, and broadcast. Multiple cameras may share a zone; duplicate doorway views may share `duplicate_group` for a two-second same-direction suppression window. MongoDB stores UTC events, snapshots, and corrections. Without `DATABASE_URL`, development mode uses process memory. WebSockets carry state, never video.
