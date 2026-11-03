# Privacy and security

The backend uses anonymous temporary tracking IDs. It has no facial recognition, biometric matching, raw-video recording, or image persistence. Snapshots are transient and marked `no-store`.

Change `API_AUTH_SECRET`, bind locally in development, terminate TLS at a trusted proxy, restrict CORS, and isolate cameras on a protected VLAN. Use read-only camera credentials and a least-privilege MongoDB user. Secrets belong in environment variables or a secret manager. Passwords are redacted.

API-key authentication protects mutations and corrections. Multi-user production deployments should add an identity-aware proxy, rotation, audit, rate limiting, and TLS.
