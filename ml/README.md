# Intruder Detection — ML Layer

## Overview
Fine-tunes two models on crime/anomaly data, then runs them together in real time on a Raspberry Pi (or any machine with a webcam + mic). Detections are POSTed to the FastAPI backend.

## Models

| Model | Purpose | Architecture |
|-------|---------|-------------|
| `models/yolov5_crime_cls.pt` | Video — classifies 14 crime categories | YOLOv8s-cls fine-tuned on UCF-Crime frames |
| `models/audio_classifier.pt` | Audio — gunshot / intrusion vs. normal | EfficientNet-B0 on log mel spectrograms |

## Data expected

```
data/
  video/
    abuse/       *.mp4 / *.avi
    arrest/
    arson/
    ...          (14 classes total)
  audio/
    gunshot/     *.wav / *.mp3
```

## Setup

```bash
cd ml
python -m venv ../venv && source ../venv/bin/activate
pip install -r requirements.txt
```

## Steps

### 1 — Download pre-trained weights
```bash
python download_models.py
```

### 2 — Train video classifier
```bash
python train_video.py
# Outputs: models/yolov5_crime_cls.pt
```

### 3 — Train audio classifier
```bash
python train_audio.py
# Outputs: models/audio_classifier.pt
# ESC-50 negative samples are auto-downloaded.
```

### 4 — Run real-time detector
```bash
python intruder_detection.py --api http://localhost:8000 --token YOUR_JWT
```

Frames are streamed to the backend via `POST /stream/frame` so the dashboard shows the live feed. Press `q` in the OpenCV window to stop.

## Late fusion logic

- Audio score > 0.75 → fire audio alert (`gunshot`)
- Video class ≠ `normal` and confidence > 0.70 → fire video alert
- Both fire in the same second → alert tagged `source=both`
