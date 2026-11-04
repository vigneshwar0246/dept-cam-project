from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "Department Occupancy Tracking"
    app_env: Literal["development", "test", "production"] = "development"
    host: str = "127.0.0.1"
    port: int = Field(8000, ge=1, le=65535)
    log_level: str = "INFO"
    database_url: str | None = None
    mongodb_uri: str | None = None
    database_name: str = "occupancy_tracking"
    yolo_model_path: str = "yolo11n.pt"
    model_path: str | None = None
    yolo_device: str = "auto"
    yolo_image_size: int = Field(640, ge=160, le=1920)
    yolo_confidence: float = Field(0.35, gt=0, le=1)
    confidence_threshold: float | None = None
    yolo_fp16: bool = True
    tracker_config: str = "bytetrack.yaml"
    camera_default_fps: float = Field(15, gt=0, le=120)
    camera_width: int = Field(1280, ge=160, le=7680)
    camera_height: int = Field(720, ge=120, le=4320)
    inference_fps: float = Field(15, gt=0, le=120)
    occupancy_snapshot_interval: float = Field(30, ge=1)
    websocket_update_interval: float = Field(1, ge=0.1)
    persistence_queue_size: int = Field(1000, ge=10, le=100000)
    api_auth_secret: str = "change-me-in-production"
    admin_username: str = "admin"
    cors_origins: str = "http://localhost:5173"
    phone_frontend_url: str = "https://localhost:5173"
    pairing_ttl_seconds: int = Field(120, ge=30, le=600)
    pairing_attempts_per_minute: int = Field(30, ge=5, le=300)
    webrtc_reconnect_grace_seconds: int = Field(300, ge=30, le=3600)
    webrtc_stun_urls: str = "stun:stun.l.google.com:19302"
    webrtc_turn_urls: str = ""
    webrtc_turn_username: str = ""
    webrtc_turn_credential: str = ""

    @model_validator(mode="after")
    def secure_production_secret(self):
        if self.app_env == "production" and self.api_auth_secret == "change-me-in-production":
            raise ValueError("API_AUTH_SECRET must be changed in production")
        return self

    @property
    def effective_database_url(self) -> str | None:
        return self.database_url or self.mongodb_uri

    @property
    def effective_model_path(self) -> str:
        return self.model_path or self.yolo_model_path

    @property
    def effective_confidence(self) -> float:
        return self.confidence_threshold or self.yolo_confidence

    @property
    def database_enabled(self) -> bool:
        return bool(self.effective_database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()

