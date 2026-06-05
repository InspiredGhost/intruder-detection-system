"""
FastAPI backend for the intruder detection system.

Endpoints:
  POST /auth/token        — login, returns JWT
  POST /predict           — store a detection alert (requires JWT)
  GET  /alerts            — return 50 most recent alerts (requires JWT)
  GET  /stats             — aggregated stats for dashboard charts (requires JWT)
  POST /stream/frame      — push a JPEG frame from the detector (requires JWT)
  GET  /stream            — MJPEG live stream (?token=JWT)
  WS   /ws/alerts         — WebSocket push for real-time alert events (?token=JWT)
  POST /webcam/detect     — run detection on a single base64 frame (requires JWT)
  POST /upload-video      — upload a video file for detection (requires JWT)
  GET  /cameras           — list registered CCTV cameras (requires JWT)
  POST /cameras           — register a CCTV camera (requires JWT)
  DELETE /cameras/{id}    — remove a CCTV camera (requires JWT)

Start:
    pip install -r requirements.txt
    uvicorn main:app --reload
"""

import asyncio
import base64
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv

load_dotenv()

from bson import ObjectId
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm

from auth import authenticate_user, create_access_token, get_current_user, verify_token
from database import get_alerts_collection, get_faces_collection
from models import AlertIn, AudioIn, AlertOut, CameraIn, DeviceConfig, FaceEncoding, FaceIn, FaceOut, FrameIn, TokenResponse
from sms import send_sms

MEDIA_DIR = Path(__file__).parent / "alerts"
MEDIA_DIR.mkdir(exist_ok=True)
DEVICE_CONFIG_PATH = Path(__file__).parent.parent / "device_config.json"

app = FastAPI(title="Intruder Detection API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# ML model — lazy-loaded, optional
# ---------------------------------------------------------------------------

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    from torchvision import models as _tv_models
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

_audio_model = None
AUDIO_MODEL_PATH = Path(__file__).parent.parent / "ml" / "models" / "audio_classifier.pt"
AUDIO_THRESHOLD  = 0.30

def _get_audio_model():
    global _audio_model
    if _audio_model is None and TORCH_AVAILABLE and AUDIO_MODEL_PATH.exists():
        m = _tv_models.efficientnet_b0(weights=None)
        m.classifier = nn.Sequential(nn.Dropout(0.3), nn.Linear(m.classifier[1].in_features, 1))
        m.load_state_dict(torch.load(str(AUDIO_MODEL_PATH), map_location="cpu"))
        m.eval()
        _audio_model = m
    return _audio_model

try:
    import face_recognition as _fr
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False

FACES_DIR = Path(__file__).parent / "faces"
FACES_DIR.mkdir(exist_ok=True)

MAX_ALERT_FRAMES = 500  # max face/alert images kept on disk

_yolo_cls_model = None   # classification (crime classes)
_yolo_det_model = None   # object detection (bounding boxes)

CRIME_CLASSES = [
    "abuse", "arrest", "arson", "assault", "burglary",
    "explosion", "fighting", "normal", "roadaccidents",
    "robbery", "shooting", "shoplifting", "stealing", "vandalism",
]

def _get_yolo():
    global _yolo_cls_model
    if _yolo_cls_model is None:
        # Use the same crime-classification model as intruder_detection.py
        model_path = os.path.join(os.path.dirname(__file__), '..', 'ml', 'models', 'yolov5_crime_cls.pt')
        _yolo_cls_model = YOLO(model_path)
    return _yolo_cls_model

def _get_det_model():
    global _yolo_det_model
    if _yolo_det_model is None:
        model_path = os.path.join(os.path.dirname(__file__), '..', 'yolov8s.pt')
        _yolo_det_model = YOLO(model_path)
    return _yolo_det_model

# Colour per COCO class — people red, vehicles cyan, weapons orange, rest amber
_COCO_COLORS: dict[int, tuple[str, str]] = {
    0:  ("person",     "#ef4444"),
    1:  ("bicycle",    "#06b6d4"),
    2:  ("car",        "#06b6d4"),
    3:  ("motorcycle", "#06b6d4"),
    4:  ("airplane",   "#06b6d4"),
    5:  ("bus",        "#06b6d4"),
    6:  ("train",      "#06b6d4"),
    7:  ("truck",      "#06b6d4"),
    43: ("knife",      "#f97316"),
    76: ("scissors",   "#f97316"),
}


# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

_latest_frame: bytes | None = None
_frame_subscribers: list[asyncio.Queue] = []
_alert_ws_clients: list[WebSocket] = []
_cameras: list[dict] = []


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/auth/token", response_model=TokenResponse, tags=["auth"])
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    if not authenticate_user(form_data.username, form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": form_data.username})
    return TokenResponse(access_token=token)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@app.post("/predict", status_code=201, tags=["detection"])
async def store_alert(
    alert: AlertIn,
    _user: str = Depends(get_current_user),
):
    col = get_alerts_collection()
    doc = alert.model_dump()
    if not doc.get("timestamp"):
        doc["timestamp"] = datetime.now(timezone.utc).isoformat()

    # Strip large blobs before storing in MongoDB
    frame_url_raw = doc.pop("frame_url", None)
    audio_b64_raw = doc.pop("audio_b64", None)

    result = await col.insert_one(doc)
    inserted_id = str(result.inserted_id)

    # Save media files and update the DB document
    media_updates: dict = {}

    if frame_url_raw and frame_url_raw.startswith("data:image"):
        try:
            b64_part = frame_url_raw.split(",", 1)[1]
            fname = f"frame_{inserted_id}.jpg"
            (MEDIA_DIR / fname).write_bytes(base64.b64decode(b64_part))
            doc["frame_file"] = fname
            media_updates["frame_file"] = fname
        except Exception:
            pass

    if audio_b64_raw:
        try:
            afname = f"audio_{inserted_id}.wav"
            (MEDIA_DIR / afname).write_bytes(base64.b64decode(audio_b64_raw))
            doc["audio_file"] = afname
            media_updates["audio_file"] = afname
        except Exception:
            pass

    if media_updates:
        from bson import ObjectId as _ObjId
        await col.update_one({"_id": _ObjId(inserted_id)}, {"$set": media_updates})

    # Enforce disk cap — remove oldest frames if over limit
    frame_files = sorted(MEDIA_DIR.glob("frame_*.jpg"), key=lambda f: f.stat().st_mtime)
    for old in frame_files[:-MAX_ALERT_FRAMES]:
        try:
            old.unlink()
        except Exception:
            pass

    broadcast_doc = {**doc, "id": inserted_id}
    dead = []
    for ws in _alert_ws_clients:
        try:
            await ws.send_text(json.dumps(broadcast_doc))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _alert_ws_clients.remove(ws)

    # Send SMS for intruder alerts
    if doc.get("type") == "intruder":
        owner_phone = os.environ.get("OWNER_PHONE", "")
        if owner_phone:
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            msg = (
                f"Unknown intruder detected at {ts}. "
                f"Confidence: {round(doc.get('confidence', 0) * 100)}%. "
                f"Check your dashboard immediately."
            )
            import asyncio as _asyncio
            loop = _asyncio.get_event_loop()
            loop.run_in_executor(None, send_sms, owner_phone, msg)

    return {"id": inserted_id}


@app.delete("/alerts", tags=["detection"])
async def clear_alerts(_user: str = Depends(get_current_user)):
    """Delete every alert from the database and remove all saved media files."""
    col = get_alerts_collection()
    result = await col.delete_many({})
    # Remove all saved media files (frames + audio clips)
    deleted_files = 0
    for f in MEDIA_DIR.iterdir():
        try:
            f.unlink()
            deleted_files += 1
        except Exception:
            pass
    return {"deleted_alerts": result.deleted_count, "deleted_files": deleted_files}


@app.get("/alerts", response_model=list[AlertOut], tags=["detection"])
async def get_alerts(
    limit: int = 100,
    _user: str = Depends(get_current_user),
):
    col = get_alerts_collection()
    cursor = col.find().sort("timestamp", -1).limit(limit)
    alerts = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        alerts.append(AlertOut(**doc))
    return alerts


# ---------------------------------------------------------------------------
# Stats — aggregated data for dashboard charts
# ---------------------------------------------------------------------------

@app.get("/stats", tags=["detection"])
async def get_stats(_user: str = Depends(get_current_user)):
    col = get_alerts_collection()

    total = await col.count_documents({})

    by_type: dict = {}
    async for doc in col.aggregate([{"$group": {"_id": "$type", "count": {"$sum": 1}}}]):
        by_type[doc["_id"]] = doc["count"]

    by_source: dict = {}
    async for doc in col.aggregate([{"$group": {"_id": "$source", "count": {"$sum": 1}}}]):
        by_source[doc["_id"]] = doc["count"]

    # Hourly counts for last 24 hours
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    hourly_pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {"_id": {"$substr": ["$timestamp", 0, 13]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    hourly_24h = []
    async for doc in col.aggregate(hourly_pipeline):
        hourly_24h.append({"hour": doc["_id"], "count": doc["count"]})

    # Recent 7-day daily totals
    since_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    daily_pipeline = [
        {"$match": {"timestamp": {"$gte": since_7d}}},
        {"$group": {"_id": {"$substr": ["$timestamp", 0, 10]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    daily_7d = []
    async for doc in col.aggregate(daily_pipeline):
        daily_7d.append({"date": doc["_id"], "count": doc["count"]})

    return {
        "total": total,
        "by_type": by_type,
        "by_source": by_source,
        "hourly_24h": hourly_24h,
        "daily_7d": daily_7d,
        "cameras_online": len(_cameras),
    }


# ---------------------------------------------------------------------------
# Webcam single-frame detection
# ---------------------------------------------------------------------------

@app.post("/webcam/detect", tags=["detection"])
async def webcam_detect(
    frame: FrameIn,
    _user: str = Depends(get_current_user),
):
    """Run face recognition on a single base64-encoded JPEG frame from the browser webcam."""
    import cv2
    import numpy as np

    img_bytes = base64.b64decode(frame.frame_b64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img_bgr   = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if not FACE_RECOGNITION_AVAILABLE:
        return {
            "type": "normal",
            "confidence": 1.0,
            "source": "video",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detected_name": None,
            "note": "face_recognition not installed — pip install face_recognition",
        }

    # Upscale small frames so HOG detector finds faces more reliably
    h, w = img_bgr.shape[:2]
    if w < 640:
        scale = 640 / w
        img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)))

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    locations = _fr.face_locations(img_rgb, model="hog", number_of_times_to_upsample=1)

    if not locations:
        return {
            "type": "normal",
            "confidence": 1.0,
            "source": "video",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detected_name": None,
        }

    encodings = _fr.face_encodings(img_rgb, locations)

    # Load enrolled faces from DB
    col = get_faces_collection()
    known_enc, known_names = [], []
    async for doc in col.find():
        known_enc.append(np.array(doc["encoding"]))
        known_names.append(doc["name"])

    results = []
    for enc in encodings:
        if known_enc:
            distances = _fr.face_distance(known_enc, enc)
            best_idx  = int(np.argmin(distances))
            best_dist = float(distances[best_idx])
            if best_dist < 0.55:
                # Known person — confidence = how close the match is (lower dist = higher conf)
                match_conf = round(float(np.clip(1.0 - best_dist / 0.55, 0.0, 1.0)), 4)
                results.append({"name": known_names[best_idx], "dist": best_dist, "conf": match_conf})
            else:
                # Unknown — confidence is always high: a face was clearly detected and it is NOT enrolled
                results.append({"name": "Unknown", "dist": best_dist, "conf": 0.92})
        else:
            # No enrolled faces at all — any face is an intruder
            results.append({"name": "Unknown", "dist": 1.0, "conf": 0.92})

    unknowns = [r for r in results if r["name"] == "Unknown"]
    friendly = [r for r in results if r["name"] != "Unknown"]

    ts = datetime.now(timezone.utc).isoformat()

    if unknowns:
        return {
            "type": "intruder",
            "confidence": 0.92,
            "source": "video",
            "timestamp": ts,
            "detected_name": "Unknown",
        }

    if friendly:
        best = min(friendly, key=lambda r: r["dist"])
        return {
            "type": "friendly",
            "confidence": best["conf"],
            "source": "video",
            "timestamp": ts,
            "detected_name": best["name"],
        }

    return {"type": "normal", "confidence": 1.0, "source": "video", "timestamp": ts, "detected_name": None}


# ---------------------------------------------------------------------------
# Bounding-box detection — object detection model
# ---------------------------------------------------------------------------

@app.post("/webcam/boxes", tags=["detection"])
async def webcam_boxes(
    frame: FrameIn,
    _user: str = Depends(get_current_user),
):
    """Run YOLOv8 object detection and return normalised bounding boxes."""
    if not YOLO_AVAILABLE:
        return {"boxes": []}

    import cv2
    import numpy as np

    img_bytes = base64.b64decode(frame.frame_b64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]

    model   = _get_det_model()
    results = model(img, verbose=False)[0]

    boxes = []
    for box in results.boxes:
        conf   = float(box.conf[0])
        if conf < 0.35:
            continue
        cls_id = int(box.cls[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        label, color = _COCO_COLORS.get(cls_id, (results.names[cls_id], "#f59e0b"))
        boxes.append({
            "label":      label,
            "confidence": round(conf, 3),
            "color":      color,
            "x1": x1 / w, "y1": y1 / h,
            "x2": x2 / w, "y2": y2 / h,
        })

    # Overlay face recognition boxes if available
    if FACE_RECOGNITION_AVAILABLE:
        img_rgb   = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        locations = _fr.face_locations(img_rgb, model="hog")
        if locations:
            face_encs = _fr.face_encodings(img_rgb, locations)
            faces_col = get_faces_collection()
            known_enc, known_names = [], []
            async for doc in faces_col.find():
                known_enc.append(np.array(doc["encoding"]))
                known_names.append(doc["name"])

            for enc, (top, right, bottom, left) in zip(face_encs, locations):
                if known_enc:
                    distances = _fr.face_distance(known_enc, enc)
                    best_idx  = int(np.argmin(distances))
                    best_dist = float(distances[best_idx])
                    if best_dist < 0.55:
                        label = known_names[best_idx]
                        color = "#22c55e"
                        conf  = round(1.0 - best_dist, 3)
                    else:
                        label = "Unknown"
                        color = "#ef4444"
                        conf  = round(1.0 - best_dist, 3)
                else:
                    label = "Unknown"
                    color = "#ef4444"
                    conf  = 0.9
                boxes.append({
                    "label": label, "confidence": conf, "color": color,
                    "x1": left / w, "y1": top / h,
                    "x2": right / w, "y2": bottom / h,
                })

    return {"boxes": boxes}


# ---------------------------------------------------------------------------
# Browser microphone audio detection
# ---------------------------------------------------------------------------

@app.post("/audio/detect", tags=["detection"])
async def audio_detect(payload: AudioIn, _user: str = Depends(get_current_user)):
    """Run audio intrusion detection on a base64-encoded WAV chunk from the browser."""
    if not TORCH_AVAILABLE:
        return {"intrusion": False, "confidence": 0.0, "note": "torch not installed on server"}

    model = _get_audio_model()
    if model is None:
        return {"intrusion": False, "confidence": 0.0, "note": "Audio model not found on server"}

    import io, numpy as np, librosa, torch.nn.functional as F

    wav_bytes = base64.b64decode(payload.audio_b64)
    waveform, _ = librosa.load(io.BytesIO(wav_bytes), sr=16000, mono=True)

    # Pad or trim to 2 seconds
    target = 16000 * 2
    if len(waveform) >= target:
        waveform = waveform[:target]
    else:
        waveform = np.pad(waveform, (0, target - len(waveform)))

    # Mel spectrogram → EfficientNet input
    mel = librosa.feature.melspectrogram(y=waveform, sr=16000, n_mels=128, hop_length=512)
    log_mel = librosa.power_to_db(mel, ref=np.max)
    log_mel = (log_mel - log_mel.min()) / (log_mel.max() - log_mel.min() + 1e-8)
    tensor = torch.tensor(log_mel, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    tensor = F.interpolate(tensor, size=(224, 224), mode="bilinear", align_corners=False)
    tensor = tensor.squeeze(0).repeat(3, 1, 1).unsqueeze(0)

    with torch.no_grad():
        prob = float(torch.sigmoid(model(tensor).squeeze()).cpu())

    return {
        "intrusion": prob > AUDIO_THRESHOLD,
        "confidence": round(prob, 4),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Upload video for detection
# ---------------------------------------------------------------------------

@app.post("/upload-video", tags=["detection"])
async def upload_video(
    file: UploadFile = File(...),
    _user: str = Depends(get_current_user),
):
    """Upload a video file; extract frames at 1fps and run detection on each."""
    if not YOLO_AVAILABLE:
        return {
            "detections": [],
            "total_frames": 0,
            "note": "ML model not installed — install ultralytics for real detection",
        }

    import cv2

    suffix = Path(file.filename or "upload.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        model = _get_yolo()
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_skip = max(1, int(fps))  # one frame per second

        detections = []
        frame_idx = 0
        col = get_alerts_collection()

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % frame_skip == 0:
                results = model(frame, verbose=False)
                top_class = results[0].probs.top1
                confidence = float(results[0].probs.top1conf)
                class_name = results[0].names[top_class]
                ts = datetime.now(timezone.utc).isoformat()

                detection = {
                    "type": class_name.lower().replace(" ", "_"),
                    "confidence": confidence,
                    "source": "video",
                    "timestamp": ts,
                    "frame_index": frame_idx,
                }
                detections.append(detection)

                if class_name.lower() not in ("normalvideos", "normal") and confidence > 0.5:
                    await col.insert_one({
                        "type": class_name.lower().replace(" ", "_"),
                        "confidence": confidence,
                        "source": "video",
                        "timestamp": ts,
                    })

            frame_idx += 1

        cap.release()
        return {"detections": detections, "total_frames": frame_idx}

    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Face recognition — enroll / list / delete / encodings
# ---------------------------------------------------------------------------

@app.post("/faces", response_model=FaceOut, status_code=201, tags=["faces"])
async def enroll_face(face: FaceIn, _user: str = Depends(get_current_user)):
    """Enroll a new friendly person by name + base64 photo."""
    if not FACE_RECOGNITION_AVAILABLE:
        raise HTTPException(500, "face_recognition library not installed on server")

    import numpy as np

    img_bytes = base64.b64decode(face.photo_b64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)

    import cv2 as _cv2
    img_bgr = _cv2.imdecode(img_array, _cv2.IMREAD_COLOR)
    img_rgb  = _cv2.cvtColor(img_bgr, _cv2.COLOR_BGR2RGB)

    encodings = _fr.face_encodings(img_rgb, _fr.face_locations(img_rgb))
    if not encodings:
        raise HTTPException(400, "No face detected in the uploaded photo. Please use a clear, front-facing photo.")

    col = get_faces_collection()
    doc = {
        "name":     face.name.strip(),
        "encoding": encodings[0].tolist(),
        "created":  datetime.now(timezone.utc).isoformat(),
    }
    result = await col.insert_one(doc)
    inserted_id = str(result.inserted_id)

    # Save photo thumbnail
    fname = f"face_{inserted_id}.jpg"
    (FACES_DIR / fname).write_bytes(img_bytes)
    await col.update_one({"_id": result.inserted_id}, {"$set": {"photo_file": fname}})

    return FaceOut(id=inserted_id, name=doc["name"], photo_url=f"/faces/media/{fname}")


@app.get("/faces", response_model=list[FaceOut], tags=["faces"])
async def list_faces(_user: str = Depends(get_current_user)):
    """Return all enrolled friendly faces."""
    col = get_faces_collection()
    faces = []
    async for doc in col.find():
        fid = str(doc["_id"])
        photo_url = f"/faces/media/{doc['photo_file']}" if doc.get("photo_file") else None
        faces.append(FaceOut(id=fid, name=doc["name"], photo_url=photo_url))
    return faces


@app.delete("/faces/{face_id}", tags=["faces"])
async def delete_face(face_id: str, _user: str = Depends(get_current_user)):
    """Remove an enrolled face."""
    col = get_faces_collection()
    doc = await col.find_one({"_id": ObjectId(face_id)})
    if not doc:
        raise HTTPException(404, "Face not found")
    if doc.get("photo_file"):
        try:
            (FACES_DIR / doc["photo_file"]).unlink(missing_ok=True)
        except Exception:
            pass
    await col.delete_one({"_id": ObjectId(face_id)})
    return {"deleted": face_id}


@app.get("/faces/encodings", response_model=list[FaceEncoding], tags=["faces"])
async def get_face_encodings(_user: str = Depends(get_current_user)):
    """Return all name+encoding pairs — consumed by the ML detection loop."""
    col = get_faces_collection()
    result = []
    async for doc in col.find():
        result.append(FaceEncoding(
            id=str(doc["_id"]),
            name=doc["name"],
            encoding=doc["encoding"],
        ))
    return result


@app.get("/faces/media/{filename}", tags=["faces"])
async def serve_face_media(filename: str, token: str = Query(default="")):
    verify_token(token)
    path = FACES_DIR / filename
    if not path.exists():
        raise HTTPException(404, "Face photo not found")
    return FileResponse(str(path), media_type="image/jpeg")


# ---------------------------------------------------------------------------
# Media file serving
# ---------------------------------------------------------------------------

@app.get("/alerts/media/{filename}", tags=["alerts"])
async def serve_media(filename: str, token: str = Query(default="")):
    verify_token(token)
    path = MEDIA_DIR / filename
    if not path.exists():
        raise HTTPException(404, "Media file not found")
    if filename.endswith(".jpg"):
        media_type = "image/jpeg"
    elif filename.endswith(".wav"):
        media_type = "audio/wav"
    else:
        media_type = "application/octet-stream"
    return FileResponse(str(path), media_type=media_type)


# ---------------------------------------------------------------------------
# Device configuration
# ---------------------------------------------------------------------------

@app.get("/devices", tags=["devices"])
async def list_devices(_user: str = Depends(get_current_user)):
    cameras = []
    try:
        import cv2
        for i in range(5):
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                cameras.append({"index": i, "name": f"Camera {i}"})
                cap.release()
    except ImportError:
        pass

    microphones = []
    try:
        import sounddevice as sd
        for i, d in enumerate(sd.query_devices()):
            if d["max_input_channels"] > 0:
                microphones.append({"index": i, "name": d["name"]})
    except (ImportError, Exception):
        pass

    # current config
    cfg = {"camera_index": 0, "audio_device": 4}
    if DEVICE_CONFIG_PATH.exists():
        import json as _json
        cfg = _json.loads(DEVICE_CONFIG_PATH.read_text())

    return {"cameras": cameras, "microphones": microphones, "current": cfg}


@app.post("/devices/config", tags=["devices"])
async def set_device_config(config: DeviceConfig, _user: str = Depends(get_current_user)):
    import json as _json
    DEVICE_CONFIG_PATH.write_text(_json.dumps(config.model_dump(), indent=2))
    return {"status": "saved", "message": "Restart the system (Ctrl+C then python start.py) to apply changes."}


# ---------------------------------------------------------------------------
# CCTV camera registry
# ---------------------------------------------------------------------------

@app.get("/cameras", tags=["cameras"])
async def get_cameras(_user: str = Depends(get_current_user)):
    return _cameras


@app.post("/cameras", status_code=201, tags=["cameras"])
async def add_camera(camera: CameraIn, _user: str = Depends(get_current_user)):
    cam = {
        "id": str(ObjectId()),
        "name": camera.name,
        "url": camera.url,
        "active": True,
    }
    _cameras.append(cam)
    return cam


@app.delete("/cameras/{camera_id}", tags=["cameras"])
async def delete_camera(camera_id: str, _user: str = Depends(get_current_user)):
    global _cameras
    _cameras = [c for c in _cameras if c["id"] != camera_id]
    return {"deleted": camera_id}


# ---------------------------------------------------------------------------
# Video stream — frame push + MJPEG serve
# ---------------------------------------------------------------------------

@app.post("/stream/frame", status_code=204, tags=["stream"])
async def push_frame(
    frame: FrameIn,
    _user: str = Depends(get_current_user),
):
    global _latest_frame
    _latest_frame = base64.b64decode(frame.frame_b64)

    dead = []
    for q in _frame_subscribers:
        try:
            q.put_nowait(_latest_frame)
        except asyncio.QueueFull:
            pass
        except Exception:
            dead.append(q)
    for q in dead:
        _frame_subscribers.remove(q)


@app.get("/stream", tags=["stream"])
async def mjpeg_stream(token: str = Query(default="")):
    verify_token(token)

    q: asyncio.Queue[bytes] = asyncio.Queue(maxsize=4)
    _frame_subscribers.append(q)

    async def generate():
        try:
            if _latest_frame:
                yield (
                    b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                    + _latest_frame
                    + b"\r\n"
                )
            while True:
                try:
                    frame_bytes = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield (
                        b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                        + frame_bytes
                        + b"\r\n"
                    )
                except asyncio.TimeoutError:
                    yield b"--frame\r\nContent-Type: text/plain\r\n\r\nkeepalive\r\n"
        finally:
            if q in _frame_subscribers:
                _frame_subscribers.remove(q)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ---------------------------------------------------------------------------
# WebSocket — real-time alert push
# ---------------------------------------------------------------------------

@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket, token: str = Query(default="")):
    try:
        verify_token(token)
    except HTTPException:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    _alert_ws_clients.append(websocket)
    try:
        while True:
            await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
    except (WebSocketDisconnect, asyncio.TimeoutError, Exception):
        pass
    finally:
        if websocket in _alert_ws_clients:
            _alert_ws_clients.remove(websocket)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "yolo_available": YOLO_AVAILABLE}


# ---------------------------------------------------------------------------
# SPA — serve React build (must come last)
# ---------------------------------------------------------------------------

_STATIC_DIR = Path(__file__).parent / "static"


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    if _STATIC_DIR.exists():
        file_path = _STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        index = _STATIC_DIR / "index.html"
        if index.exists():
            return HTMLResponse(index.read_text())
    raise HTTPException(404, "Not found")
