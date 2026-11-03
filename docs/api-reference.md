# API reference

Health: `GET /api/health`, `/api/system/status`, `/api/system/performance`.

Cameras: `GET/POST /api/cameras`, `GET/PUT/DELETE /api/cameras/{id}`, `POST /api/cameras/{id}/start|stop`, `GET /api/cameras/{id}/snapshot|config`, `PUT /api/cameras/{id}/config`.

Occupancy: `GET /api/occupancy`, `GET /api/occupancy/{zone}`, `POST /api/occupancy/{zone}/correction`, `GET /api/occupancy/history`.

Events/analytics: `GET /api/events`, `/api/events/summary`, `/api/analytics/daily`, `/api/analytics/hourly`, `/api/analytics/peak-hours`. History accepts `page` and `page_size` (maximum 200).

WebSockets: `/ws/occupancy`, `/ws/cameras/{id}`. Full schemas are at `/docs`. Mutating routes require `X-API-Key`.
