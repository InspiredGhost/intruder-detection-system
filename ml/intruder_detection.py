"""
Real-time audio-visual intruder detection with late fusion.

Captures webcam video + microphone audio simultaneously.
Every second:
  - YOLOv5-cls classifies the current frame (14 crime classes)
  - EfficientNet-B0 audio model scores the audio chunk (gunshot/intrusion vs. normal)
  - Late fusion fires an alert when either model exceeds its confidence threshold
  - Alert is POSTed to the FastAPI backend

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

from utils.audio_utils import load_audio, pad_or_trim, waveform_to_melspec, TARGET_SR

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
AUDIO_MODEL_PATH = Path(__file__).parent / "models" / "audio_classifier.pt"
VIDEO_MODEL_PATH = Path(__file__).parent / "models" / "yolov5_crime_cls.pt"

AUDIO_THRESHOLD = 0.50   # lowered so glass-breaking / screaming / intrusion sounds trigger alerts
VIDEO_THRESHOLD = 0.70
AUDIO_CHUNK_S   = 1.0

VIDEO_CLASSES = [
    "abuse", "arrest", "arson", "assault", "burglary",
    "explosion", "fighting", "normal", "roadaccidents",
    "robbery", "shooting", "shoplifting", "stealing", "vandalism",
]

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"


# ---------------------------------------------------------------------------
# Audio capture
# ---------------------------------------------------------------------------

class AudioCapture:
    def __init__(self, sr: int = TARGET_SR, device=None):
        self._sr = sr
        self._ring = np.zeros(sr * 5, dtype=np.float32)  # 5-second ring buffer
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
        # Inference queue
        if not self._buf.full():
            self._buf.put_nowait(chunk)
        # Update ring buffer
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
        """Return the last 5 seconds of audio in chronological order."""
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
    """Convert float32 numpy array to WAV bytes (PCM 16-bit mono)."""
    samples_i16 = (samples * 32767).clip(-32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(samples_i16.tobytes())
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def load_audio_model() -> nn.Module:
    model = models.efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(nn.Dropout(0.3), nn.Linear(in_features, 1))
    model.load_state_dict(torch.load(AUDIO_MODEL_PATH, map_location=DEVICE))
    model.to(DEVICE).eval()
    return model


def load_video_model():
    from ultralytics import YOLO
    return YOLO(str(VIDEO_MODEL_PATH))


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

@torch.no_grad()
def infer_audio(model: nn.Module, chunk: np.ndarray) -> float:
    chunk = pad_or_trim(chunk, TARGET_SR)
    spec = waveform_to_melspec(chunk).unsqueeze(0).to(DEVICE)
    logit = model(spec).squeeze()
    return float(torch.sigmoid(logit).cpu())


def infer_video(video_model, frame: np.ndarray) -> tuple[str, float]:
    results = video_model(frame, verbose=False)
    probs = results[0].probs
    top_idx  = int(probs.top1)
    top_conf = float(probs.top1conf)
    top_class = VIDEO_CLASSES[top_idx] if top_idx < len(VIDEO_CLASSES) else "unknown"
    return top_class, top_conf


# ---------------------------------------------------------------------------
# Alert dispatch
# ---------------------------------------------------------------------------

def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"} if token else {}


def dispatch_alert(api_base: str, token: str, alert_type: str,
                   confidence: float, source: str,
                   frame: np.ndarray | None = None,
                   audio_cap: "AudioCapture | None" = None):
    payload = {
        "timestamp":  datetime.now(timezone.utc).isoformat(),
        "type":       alert_type,
        "confidence": round(confidence, 4),
        "source":     source,
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
    """Send the current video frame to the backend MJPEG stream endpoint."""
    try:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        b64 = base64.b64encode(buf).decode()
        httpx.post(f"{api_base}/stream/frame", json={"frame_b64": b64},
                   headers=_auth_headers(token), timeout=2.0)
    except Exception:
        pass  # stream push is best-effort


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run(api_base: str, token: str, audio_device=None, camera: int = 0):
    if not AUDIO_MODEL_PATH.exists():
        print(f"ERROR: Audio model not found — run train_audio.py first.")
        return
    if not VIDEO_MODEL_PATH.exists():
        print(f"ERROR: Video model not found — run train_video.py first.")
        return

    # Show which mic is being used
    import sounddevice as sd
    dev_info = sd.query_devices(audio_device, kind="input") if audio_device is not None \
               else sd.query_devices(kind="input")
    print(f"  Microphone: [{audio_device}] {dev_info['name']}")

    audio_model = load_audio_model()
    video_model = load_video_model()
    audio_cap   = AudioCapture(device=audio_device)
    cap         = cv2.VideoCapture(camera)

    if not cap.isOpened():
        print("ERROR: Cannot open webcam.")
        return

    audio_cap.start()
    print(f"\n=== Intruder Detection Running (device: {DEVICE}) ===")
    print("Press 'q' in the video window to quit.\n")

    last_infer = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            now = time.time()
            if now - last_infer >= AUDIO_CHUNK_S:
                last_infer = now
                alerts = []

                chunk = audio_cap.get_chunk()
                if chunk is None:
                    print("[AUDIO] no chunk yet — waiting for mic buffer...")
                else:
                    prob = infer_audio(audio_model, chunk)
                    label = "ALERT ⚠" if prob > AUDIO_THRESHOLD else "ok"
                    print(f"[AUDIO] prob={prob:.3f}  threshold={AUDIO_THRESHOLD}  → {label}")
                    if prob > AUDIO_THRESHOLD:
                        alerts.append(("gunshot", prob, "audio"))

                v_class, v_conf = infer_video(video_model, frame)
                if v_class != "normal" and v_conf > VIDEO_THRESHOLD:
                    alerts.append((v_class, v_conf, "video"))
                    print(f"[VIDEO ALERT] {v_class}  conf={v_conf:.3f}")

                if len(alerts) == 2:
                    best = max(alerts, key=lambda a: a[1])
                    dispatch_alert(api_base, token, best[0], best[1], "both", frame, audio_cap)
                elif len(alerts) == 1:
                    a_type, a_conf, a_src = alerts[0]
                    dispatch_alert(api_base, token, a_type, a_conf, a_src, frame, audio_cap)

                color = (0, 0, 255) if v_class != "normal" else (0, 200, 0)
                cv2.putText(frame, f"{v_class.upper()} {v_conf:.2f}",
                            (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

                # Push annotated frame to the backend for live stream viewers
                if api_base:
                    threading.Thread(
                        target=push_frame, args=(api_base, token, frame.copy()), daemon=True
                    ).start()

            cv2.imshow("Intruder Detection", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        audio_cap.stop()
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
