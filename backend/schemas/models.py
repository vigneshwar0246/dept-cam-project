from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator


class CameraType(str, Enum):
    LAPTOP = "laptop"
    MOBILE = "mobile"
    RTSP = "rtsp"


class Point(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class LineConfig(BaseModel):
    start: Point = Point(x=0.1, y=0.5)
    end: Point = Point(x=0.9, y=0.5)
    enter_side: Literal["positive", "negative"] = "positive"
    cooldown_seconds: float = Field(2, ge=0, le=60)
    hysteresis: float = Field(0.01, ge=0, le=0.25)

    @model_validator(mode="after")
    def distinct_points(self):
        if self.start == self.end:
            raise ValueError("counting line endpoints must differ")
        return self


class CameraCreate(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    name: str = Field(min_length=1, max_length=100)
    type: CameraType
    zone_id: str = Field(min_length=1, max_length=64)
    source: int | str
    width: int = Field(1280, ge=160, le=7680)
    height: int = Field(720, ge=120, le=4320)
    fps: float = Field(15, gt=0, le=120)
    line: LineConfig = LineConfig()
    duplicate_group: str | None = Field(default=None, max_length=64)
    enabled: bool = True

    @model_validator(mode="after")
    def validate_source(self):
        if self.type == CameraType.LAPTOP:
            if isinstance(self.source, bool) or not isinstance(self.source, int) or self.source < 0:
                raise ValueError("laptop source must be a non-negative camera index")
        else:
            value = str(self.source)
            if self.type == CameraType.RTSP and not value.lower().startswith(("rtsp://", "rtsps://")):
                raise ValueError("RTSP source must use rtsp:// or rtsps://")
            if self.type == CameraType.MOBILE and not value.lower().startswith(("http://", "https://", "rtsp://", "rtsps://", "webrtc://")):
                raise ValueError("mobile source must be an HTTP(S), RTSP, or WebRTC source")
        return self


class CameraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    zone_id: str | None = Field(default=None, min_length=1, max_length=64)
    source: int | str | None = None
    width: int | None = Field(default=None, ge=160, le=7680)
    height: int | None = Field(default=None, ge=120, le=4320)
    fps: float | None = Field(default=None, gt=0, le=120)
    line: LineConfig | None = None
    duplicate_group: str | None = None
    enabled: bool | None = None


class CorrectionRequest(BaseModel):
    occupancy: int = Field(ge=0)
    reason: str = Field(min_length=3, max_length=500)


class PairingCreate(BaseModel):
    camera_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    camera_name: str = Field(min_length=1, max_length=100)
    zone_id: str = Field(min_length=1, max_length=64)
    width: int = Field(1280, ge=160, le=1920)
    height: int = Field(720, ge=120, le=1080)
    fps: float = Field(15, gt=0, le=30)


class WebRTCOffer(BaseModel):
    sdp: str = Field(min_length=1, max_length=1_000_000)
    type: Literal["offer"] = "offer"
    client_id: str = Field(min_length=16, max_length=128)


class ICECandidate(BaseModel):
    candidate: str = Field(max_length=4096)
    sdp_mid: str | None = Field(default=None, max_length=64)
    sdp_mline_index: int | None = Field(default=None, ge=0, le=32)
    client_id: str = Field(min_length=16, max_length=128)

