# Performance

Latency controls include a one-frame buffer, configurable `INFERENCE_FPS`, one model instance, FP16 on verified CUDA, async processing, and a bounded database queue. `/api/system/performance` reports measured FPS, inference/event latency, queue depth, and GPU memory; values are measurements, not promises.

The 20–30 FPS and sub-500 ms figures are targets dependent on resolution, encoding/network, stream count, and GPU contention. Tune image size and inference FPS after measuring.
