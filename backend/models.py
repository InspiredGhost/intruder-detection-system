from pydantic import BaseModel, Field
from typing import Literal, Optional


class AlertIn(BaseModel):
    timestamp: str
    type: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    source: Literal["audio", "video", "both"]
    frame_url: Optional[str] = None
    audio_event: Optional[str] = None
    frame_file: Optional[str] = None
    audio_file: Optional[str] = None
    audio_b64: Optional[str] = None   # raw base64 WAV, stripped before DB insert
    detected_name: Optional[str] = None  # face recognition result


class AlertOut(AlertIn):
    id: str


class FaceIn(BaseModel):
    name: str
    photo_b64: str  # base64-encoded JPEG


class FaceOut(BaseModel):
    id: str
    name: str
    photo_url: Optional[str] = None


class FaceEncoding(BaseModel):
    id: str
    name: str
    encoding: list[float]  # 128-d face embedding


class DeviceConfig(BaseModel):
    camera_index: int = 0
    audio_device: int = 4


class TokenRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FrameIn(BaseModel):
    frame_b64: str  # base64-encoded JPEG bytes

class AudioIn(BaseModel):
    audio_b64: str  # base64-encoded WAV bytes


class DetectionResult(BaseModel):
    type: str
    confidence: float
    source: str = "video"
    timestamp: str
    frame_index: Optional[int] = None


class CameraIn(BaseModel):
    name: str
    url: str  # HTTP MJPEG or RTSP URL


class CameraOut(CameraIn):
    id: str
    active: bool = True
