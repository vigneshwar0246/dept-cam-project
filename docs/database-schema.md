# Database schema

The app uses MongoDB database `occupancy_tracking` through PyMongo Async.

- `cameras`: validated camera configurations keyed by unique `id`.
- `occupancy_events`: anonymous line crossings with zone, camera, event type, track ID, and timestamp.
- `occupancy_snapshots`: periodic occupancy, entry, and exit state.
- `occupancy_corrections`: audited manual corrections and reasons.

There is no zones collection. Zones derive from cameras and occupancy state; frontend capacity values are browser-local display preferences. Without `DATABASE_URL`, development mode uses non-persistent process memory.
