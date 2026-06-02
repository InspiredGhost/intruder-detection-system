import cv2
import numpy as np
from pathlib import Path


def extract_frames(video_path: str, n_frames: int = 10) -> list[np.ndarray]:
    """Uniformly sample n_frames from a video file. Returns list of BGR frames."""
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []

    indices = np.linspace(0, total - 1, n_frames, dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
    cap.release()
    return frames


def save_frames(frames: list[np.ndarray], out_dir: str, prefix: str) -> list[str]:
    """Save frames as JPEGs under out_dir, return list of saved paths."""
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    paths = []
    for i, frame in enumerate(frames):
        path = str(Path(out_dir) / f"{prefix}_frame{i:03d}.jpg")
        cv2.imwrite(path, frame)
        paths.append(path)
    return paths


def preprocess_frame(frame: np.ndarray, size: int = 224) -> np.ndarray:
    """Resize and convert BGR frame to RGB numpy array for model input."""
    frame = cv2.resize(frame, (size, size))
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
