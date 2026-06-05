"""
Real-time audio-visual intruder detection with face recognition.

Captures webcam video + microphone audio simultaneously.
Every second:
  - face_recognition identifies faces in the current frame
    - Known face  → label as friendly (green box)
    - Unknown face → fire intruder alert + send cropped face photo to backend
  - EfficientNet-B0 audio model scores the audio chunk (gunshot/intrusion vs. normal)
  - Audio alert fires independently when threshold is exceeded

Usage:
    source ../venv/bin/activate
    python intruder_detection.py [--api http://localhost:8000] [--token JWT_TOKEN]
"""

import argparse
import base64
import io
import queue
import threading
import time
import wave
from datetime import datetime, timezone
from pathlib import Path

import cv2
import httpx
import numpy as np
import sounddevice as sd
import torch
import torch.nn as nn
from torchvision import models
import face_recognition

from utils.audio_utils import load_audio, pad_or_trim, waveform_to_melspec, TARGET_SR

TORCH_AVAILABLE = True

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
AUDIO_MODEL_PATH = Path(__file__).parent / "models" / "audio_classifier.pt"

AUDIO_THRESHOLD  = 0.30   # lowered — glass break is brief and scores lower than gunshots
FACE_THRESHOLD   = 0.55
AUDIO_CHUNK_S    = 2.0   # 2s window catches the full glass break transient
ALERT_COOLDOWN_S = 10.0

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

# ---------------------------------------------------------------------------
# Enrolled faces — refreshed from backend every 30 s
# ---------------------------------------------------------------------------

_known_encodings: list[np.ndarray] = []
_known_names:     list[str]        = []
_encodings_lock = threading.Lock()


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"} if token else {}


def refresh_encodings(api_base: str, token: str):
    """Pull latest enrolled face encodings from the backend."""
    try:
        r = httpx.get(f"{api_base}/faces/encodings",
                      headers=_auth_headers(token), timeout=5.0)
        data = r.json()
        with _encodings_lock:
            _known_encodings.clear()
            _known_names.clear()
            for item in data:
                _known_encodings.append(np.array(item["encoding"], dtype=np.float64))
                _known_names.append(item["name"])
        print(f"[FACE] {len(_known_names)} enrolled: {_known_names or ['(none yet)']}")
    except Exception as e:
        print(f"[FACE] Could not fetch encodings: {e}")


def _encoding_refresh_loop(api_base: str, token: str):
    while True:
        time.sleep(30)
        refresh_encodings(api_base, token)


# ---------------------------------------------------------------------------
# Audio capture
# ---------------------------------------------------------------------------

class AudioCapture:
    def __init__(self, sr: int = TARGET_SR, device=None):
        self._sr = sr
        self._ring = np.zeros(sr * 5, dtype=np.float32)
        self._write_pos = 0
        self._lock = threading.Lock()
        self._buf: queue.Queue = queue.Queue(maxsize=5)
        self._stream = sd.InputStream(
            samplerate=sr, channels=1, dtype="float32",
            blocksize=int(sr * AUDIO_CHUNK_S),
            device=device,
            callback=self._callback,
        )

    def _callback(self, indata, frames, time_info, status):
        chunk = indata[:, 0].copy()
        if not self._buf.full():
            self._buf.put_nowait(chunk)
        with self._lock:
            n = len(chunk)
            ring_len = len(self._ring)
            end = self._write_pos + n
            if end <= ring_len:
                self._ring[self._write_pos:end] = chunk
            else:
                first = ring_len - self._write_pos
                self._ring[self._write_pos:] = chunk[:first]
                self._ring[:n - first] = chunk[first:]
            self._write_pos = end % ring_len

    def get_last_5s(self) -> np.ndarray:
        with self._lock:
            return np.concatenate([
                self._ring[self._write_pos:],
                self._ring[:self._write_pos],
            ]).copy()

    def start(self):  self._stream.start()
    def stop(self):   self._stream.stop(); self._stream.close()

    def get_chunk(self) -> np.ndarray | None:
        try:    return self._buf.get_nowait()
        except queue.Empty: return None


def _wav_bytes(samples: np.ndarray, sr: int = TARGET_SR) -> bytes:
    samples_i16 = (samples * 32767).clip(-32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(samples_i16.tobytes())
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Audio model (skipped on Pi slim install where torch is not available)
# ---------------------------------------------------------------------------

def load_audio_model() -> nn.Module:
    model = models.efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(nn.Dropout(0.3), nn.Linear(in_features, 1))
    model.load_state_dict(torch.load(AUDIO_MODEL_PATH, map_location=DEVICE))
    model.to(DEVICE).eval()
    return model


@torch.no_grad()
def infer_audio(model: nn.Module, chunk: np.ndarray) -> float:
    chunk = pad_or_trim(chunk, TARGET_SR)
    spec  = waveform_to_melspec(chunk).unsqueeze(0).to(DEVICE)
    logit = model(spec).squeeze()
    return float(torch.sigmoid(logit).cpu())


# ---------------------------------------------------------------------------
# Face recognition inference
# ---------------------------------------------------------------------------

def infer_faces(frame: np.ndarray) -> list[dict]:
    """
    Detect and identify all faces in a BGR frame.
    Returns list of {name, confidence, location: (top, right, bottom, left)}.
    """
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    locations = face_recognition.face_locations(rgb, model="hog")
    if not locations:
        return []

    encodings = face_recognition.face_encodings(rgb, locations)

    with _encodings_lock:
        known_enc   = list(_known_encodings)
        known_names = list(_known_names)

    results = []
    for enc, loc in zip(encodings, locations):
        if known_enc:
            distances = face_recognition.face_distance(known_enc, enc)
            best_idx  = int(np.argmin(distances))
            best_dist = float(distances[best_idx])
            if best_dist < FACE_THRESHOLD:
                name       = known_names[best_idx]
                # Confidence: how close the match is relative to threshold
                confidence = round(float(np.clip(1.0 - best_dist / FACE_THRESHOLD, 0.0, 1.0)), 4)
            else:
                name       = "Unknown"
                # Face clearly detected, definitively not enrolled — fixed high confidence
                confidence = 0.92
        else:
            name       = "Unknown"
            confidence = 0.92  # any face is unknown when no one is enrolled

        results.append({"name": name, "confidence": confidence, "location": loc})

    return results


def crop_face(frame: np.ndarray, location: tuple) -> np.ndarray:
    """Crop and return a face region with a small padding."""
    top, right, bottom, left = location
    h, w = frame.shape[:2]
    pad = 20
    t = max(0, top - pad)
    r = min(w, right + pad)
    b = min(h, bottom + pad)
    l = max(0, left - pad)
    return frame[t:b, l:r]


# ---------------------------------------------------------------------------
# Alert dispatch
# ---------------------------------------------------------------------------

def dispatch_alert(api_base: str, token: str, alert_type: str,
                   confidence: float, source: str,
                   detected_name: str | None = None,
                   frame: np.ndarray | None = None,
                   audio_cap: "AudioCapture | None" = None):
    payload = {
        "timestamp":     datetime.now(timezone.utc).isoformat(),
        "type":          alert_type,
        "confidence":    round(confidence, 4),
        "source":        source,
        "detected_name": detected_name,
    }
    if frame is not None:
        _, buf = cv2.imencode(".jpg", frame)
        payload["frame_url"] = "data:image/jpeg;base64," + base64.b64encode(buf).decode()

    if audio_cap is not None and source in ("audio", "both"):
        try:
            wav = _wav_bytes(audio_cap.get_last_5s())
            payload["audio_b64"] = base64.b64encode(wav).decode()
        except Exception as e:
            print(f"  [audio save failed] {e}")

    try:
        httpx.post(f"{api_base}/predict", json=payload,
                   headers=_auth_headers(token), timeout=5.0)
    except Exception as e:
        print(f"  [dispatch failed] {e}")


def push_frame(api_base: str, token: str, frame: np.ndarray):
    try:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        b64 = base64.b64encode(buf).decode()
        httpx.post(f"{api_base}/stream/frame", json={"frame_b64": b64},
                   headers=_auth_headers(token), timeout=2.0)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run(api_base: str, token: str, audio_device=None, camera: int = 0):
    if not AUDIO_MODEL_PATH.exists():
        print("ERROR: Audio model not found — run train_audio.py first.")
        return

    dev_info = sd.query_devices(audio_device, kind="input") if audio_device is not None \
               else sd.query_devices(kind="input")
    print(f"  Microphone: [{audio_device}] {dev_info['name']}")

    # Load enrolled faces on startup, then refresh in background
    refresh_encodings(api_base, token)
    threading.Thread(target=_encoding_refresh_loop, args=(api_base, token),
                     daemon=True).start()

    audio_model = load_audio_model()
    audio_cap   = AudioCapture(device=audio_device)
    cap         = cv2.VideoCapture(camera)

    camera_ok = cap.isOpened()
    if not camera_ok:
        print(f"WARNING: Cannot open webcam (index {camera}) — running in audio-only mode.")
    else:
        print(f"  Camera: index {camera} opened.")

    audio_cap.start()
    print(f"\n=== Intruder Detection Running (device: {DEVICE}) ===")
    if camera_ok:
        print("Press 'q' in the video window to quit.\n")
    else:
        print("Audio-only mode active. Press Ctrl+C to quit.\n")

    last_infer      = 0.0
    last_alert_time = 0.0  # cooldown tracker for intruder alerts

    try:
        while True:
            frame = None
            if camera_ok:
                ret, frame = cap.read()
                if not ret:
                    print("WARNING: Lost camera feed — switching to audio-only mode.")
                    camera_ok = False
                    frame = None

            now = time.time()
            if now - last_infer >= AUDIO_CHUNK_S:
                last_infer = now
                alerts = []

                # --- Audio inference ---
                chunk = audio_cap.get_chunk()
                if chunk is None:
                    print("[AUDIO] no chunk yet — waiting for mic buffer...")
                else:
                    prob  = infer_audio(audio_model, chunk)
                    label = "ALERT ⚠" if prob > AUDIO_THRESHOLD else "ok"
                    print(f"[AUDIO] prob={prob:.3f}  threshold={AUDIO_THRESHOLD}  → {label}")
                    if prob > AUDIO_THRESHOLD:
                        alerts.append(("suspicious_audio", prob, "audio", None, None))

                # --- Face recognition ---
                if frame is not None:
                    face_results = infer_faces(frame)

                    for fr in face_results:
                        name     = fr["name"]
                        conf     = fr["confidence"]
                        loc      = fr["location"]
                        top, right, bottom, left = loc

                        if name == "Unknown":
                            color = (0, 0, 255)
                            label_text = f"UNKNOWN  {conf:.2f}"
                            face_crop = crop_face(frame, loc)
                            alerts.append(("intruder", conf, "video", "Unknown", face_crop))
                        else:
                            color = (0, 200, 0)
                            label_text = f"{name}  {conf:.2f}"

                        cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
                        cv2.putText(frame, label_text, (left, top - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)

                    if not face_results:
                        cv2.putText(frame, "No face detected", (10, 30),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 180, 180), 2)

                # --- Dispatch alerts ---
                intruder_alerts = [a for a in alerts if a[2] == "video" and a[0] == "intruder"]
                audio_alerts    = [a for a in alerts if a[2] == "audio"]

                # Intruder alert — respect cooldown to avoid spam
                if intruder_alerts and (now - last_alert_time) >= ALERT_COOLDOWN_S:
                    best = max(intruder_alerts, key=lambda a: a[1])
                    src  = "both" if audio_alerts else "video"
                    dispatch_alert(api_base, token, best[0], best[1], src,
                                   detected_name=best[3],
                                   frame=best[4],  # cropped face photo
                                   audio_cap=audio_cap if audio_alerts else None)
                    last_alert_time = now
                    print(f"[INTRUDER ALERT] conf={best[1]:.3f}  source={src}")

                # Audio-only alert (no face detection active)
                elif audio_alerts and not intruder_alerts:
                    a_type, a_conf, a_src, _, _ = audio_alerts[0]
                    dispatch_alert(api_base, token, a_type, a_conf, a_src,
                                   audio_cap=audio_cap)

                # Push annotated frame to MJPEG stream
                if frame is not None and api_base:
                    threading.Thread(
                        target=push_frame, args=(api_base, token, frame.copy()),
                        daemon=True,
                    ).start()

            if frame is not None:
                cv2.imshow("Intruder Detection", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            else:
                time.sleep(0.1)

    finally:
        audio_cap.stop()
        if cap.isOpened():
            cap.release()
        cv2.destroyAllWindows()
        print("Stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api",          default="http://localhost:8000")
    parser.add_argument("--token",        default="")
    parser.add_argument("--audio-device", type=int, default=4,
                        help="sounddevice input device index (default 4 = MacBook Pro Microphone)")
    parser.add_argument("--camera",       type=int, default=0,
                        help="cv2.VideoCapture device index (default 0)")
    args = parser.parse_args()
    run(args.api, args.token, audio_device=args.audio_device, camera=args.camera)
