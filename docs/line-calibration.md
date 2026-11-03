# Counting-line calibration

Start the camera and open `/api/cameras/{id}/snapshot`. Choose two normalized endpoints (`0` to `1`) spanning the doorway, perpendicular to walking direction. Update `line.start`, `line.end`, and `enter_side` through `PUT /api/cameras/{id}/config` with the admin API key.

The tracked person's bottom-center must move from one side to the other beyond `hysteresis`; touching the line is not a crossing. Walk once each way, inspect events, and reverse `enter_side` if labels are swapped. Cooldown rejects rapid duplicate flips while permitting later backtracking.
