from fastapi.testclient import TestClient

from backend.core.config import Settings
from backend.main import create_app
from unittest.mock import patch


def make_client():
    settings = Settings(app_env="test", database_url=None, mongodb_uri=None, api_auth_secret="test-key", websocket_update_interval=0.1, _env_file=None)
    return TestClient(create_app(settings))


def test_health_status_and_authentication():
    with make_client() as client:
        assert client.get("/api/admin/verify").status_code == 401
        assert client.get("/api/admin/verify", headers={"X-API-Key": "test-key"}).json() == {"authorized": True}
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/system/status").json()["cuda_available"] is True
        payload = {"id": "cam1", "name": "Door", "type": "laptop", "zone_id": "dept", "source": 0}
        assert client.post("/api/cameras", json=payload).status_code == 401
        assert client.post("/api/cameras", json=payload, headers={"X-API-Key": "test-key"}).status_code == 201
        assert client.get("/api/cameras/cam1").json()["source"] == "0"


def test_correction_audit_and_history_in_development_mode():
    with make_client() as client:
        response = client.post("/api/occupancy/dept/correction", json={"occupancy": 4, "reason": "manual headcount"}, headers={"X-API-Key": "test-key"})
        assert response.status_code == 200
        assert response.json()["occupancy"] == 4
        assert client.get("/api/occupancy/dept").json()["occupancy"] == 4


def test_occupancy_websocket_heartbeat():
    with make_client() as client:
        with client.websocket_connect("/ws/occupancy") as websocket:
            message = websocket.receive_json()
            assert message["type"] == "heartbeat"


def test_local_camera_discovery_requires_admin():
    with make_client() as client:
        assert client.get("/api/cameras/discover/local").status_code == 401
        with patch("backend.api.routes.discover_local_cameras", return_value=[{"index": 0, "width": 1280, "height": 720, "fps": 30}]):
            response = client.get("/api/cameras/discover/local", headers={"X-API-Key": "test-key"})
        assert response.json()[0]["index"] == 0

