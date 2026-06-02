"""
Fine-tune YOLOv8s-cls on 14 UCF-Crime video classes.

Steps:
  1. Extract frames from each video (10 frames/video, split by video to avoid leakage)
  2. Organise frames into ImageNet-style train/val/test folders
  3. Run YOLOv8 classify/train

Classes: abuse, arrest, arson, assault, burglary, explosion, fighting,
         normal, roadaccidents, robbery, shooting, shoplifting, stealing, vandalism

Checkpointing:
  Ultralytics automatically saves last.pt and best.pt after every epoch inside
  models/yolov8_crime_cls/weights/.  If training is interrupted, re-running this
  script detects the existing run and resumes via --resume automatically.

Usage:
    pip install -r requirements.txt
    python train_video.py
"""

import shutil
import time
from pathlib import Path
from sklearn.model_selection import train_test_split
from tqdm import tqdm

from utils.video_utils import extract_frames, save_frames

# ---------------------------------------------------------------------------
# Paths & hyper-parameters
# ---------------------------------------------------------------------------
VIDEO_DIR     = Path(__file__).parent.parent / "data" / "video"
FRAMES_DIR    = Path(__file__).parent / "data_cache" / "crime_frames"
MODEL_OUT_DIR = Path(__file__).parent / "models"
RUN_DIR       = MODEL_OUT_DIR / "yolov8_crime_cls"

N_FRAMES   = 10     # frames sampled per video
IMG_SIZE   = 224
EPOCHS     = 30
BATCH_SIZE = 32
VAL_SPLIT  = 0.15
TEST_SPLIT = 0.15

CLASSES = [
    "abuse", "arrest", "arson", "assault", "burglary",
    "explosion", "fighting", "normal", "roadaccidents",
    "robbery", "shooting", "shoplifting", "stealing", "vandalism",
]


# ---------------------------------------------------------------------------
# Step 1 — collect videos per class
# ---------------------------------------------------------------------------

def collect_videos() -> dict[str, list[Path]]:
    class_videos: dict[str, list[Path]] = {}
    for cls in CLASSES:
        cls_dir = VIDEO_DIR / cls
        if not cls_dir.exists():
            print(f"  Warning: class dir not found: {cls_dir}")
            class_videos[cls] = []
            continue
        videos = (
            list(cls_dir.glob("*.mp4"))
            + list(cls_dir.glob("*.avi"))
            + list(cls_dir.glob("*.mkv"))
        )
        class_videos[cls] = videos
        print(f"  {cls}: {len(videos)} videos")
    return class_videos


# ---------------------------------------------------------------------------
# Step 2 — split videos and extract frames (with per-class progress)
# ---------------------------------------------------------------------------

def build_frame_dataset(class_videos: dict[str, list[Path]]):
    """Extract frames, split by video, write into FRAMES_DIR/{split}/{class}/."""
    for split in ["train", "val", "test"]:
        for cls in CLASSES:
            (FRAMES_DIR / split / cls).mkdir(parents=True, exist_ok=True)

    total_videos = sum(len(v) for v in class_videos.values())
    overall = tqdm(total=total_videos, desc="Extracting frames", unit="video")

    for cls, videos in class_videos.items():
        if not videos:
            continue

        idx = list(range(len(videos)))
        if len(idx) < 3:
            splits = {"train": idx, "val": [], "test": []}
        else:
            idx_trainval, idx_test = train_test_split(idx, test_size=TEST_SPLIT, random_state=42)
            idx_train, idx_val = train_test_split(
                idx_trainval,
                test_size=VAL_SPLIT / (1 - TEST_SPLIT),
                random_state=42,
            )
            splits = {"train": idx_train, "val": idx_val, "test": idx_test}

        for split_name, split_idx in splits.items():
            out_dir = str(FRAMES_DIR / split_name / cls)
            for i in split_idx:
                video_path = videos[i]
                frames = extract_frames(str(video_path), n_frames=N_FRAMES)
                save_frames(frames, out_dir, video_path.stem)
                overall.set_postfix(cls=cls, split=split_name)
                overall.update(1)

    overall.close()
    print(f"\nFrames written to {FRAMES_DIR}")


# ---------------------------------------------------------------------------
# Step 3 — YOLOv8 classification training (with auto-resume)
# ---------------------------------------------------------------------------

def train_yolov8():
    from ultralytics import YOLO

    last_pt  = RUN_DIR / "weights" / "last.pt"
    best_pt  = RUN_DIR / "weights" / "best.pt"

    if last_pt.exists():
        # Interrupted run detected — resume from where it left off
        print(f"\n>>> Checkpoint found: {last_pt}")
        print(">>> Resuming training...\n")
        model   = YOLO(str(last_pt))
        results = model.train(resume=True)
    else:
        # Fresh run
        print("\n>>> Starting fresh YOLOv8 classification training...\n")
        model   = YOLO("yolov8s-cls.pt")
        results = model.train(
            data      = str(FRAMES_DIR),
            epochs    = EPOCHS,
            imgsz     = IMG_SIZE,
            batch     = BATCH_SIZE,
            project   = str(MODEL_OUT_DIR),
            name      = "yolov8_crime_cls",
            pretrained= True,
            patience  = 10,
            save      = True,      # saves last.pt + best.pt every epoch
            save_period=1,         # checkpoint every epoch
            verbose   = True,
        )

    # Copy best weights to the fixed path the detector expects
    best_pt = RUN_DIR / "weights" / "best.pt"
    dest    = MODEL_OUT_DIR / "yolov5_crime_cls.pt"
    if best_pt.exists():
        shutil.copy(best_pt, dest)
        print(f"\nBest weights copied → {dest}")
    else:
        print(f"Warning: best weights not found at {best_pt}")

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    MODEL_OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  Video Classifier Training — YOLOv8s-cls")
    print(f"  Classes : {len(CLASSES)}   Epochs : {EPOCHS}   Batch : {BATCH_SIZE}")
    print(f"{'='*60}\n")

    print("=== Collecting videos ===")
    class_videos = collect_videos()
    total_videos = sum(len(v) for v in class_videos.values())
    print(f"\nTotal videos: {total_videos}")

    # Frame extraction is cached — skip if already done
    if FRAMES_DIR.exists() and any(FRAMES_DIR.rglob("*.jpg")):
        n_frames = sum(1 for _ in FRAMES_DIR.rglob("*.jpg"))
        print(f"\nFrame cache exists ({n_frames} frames) — skipping extraction.")
        print("Delete data_cache/crime_frames/ to force re-extraction.")
    else:
        print("\n=== Extracting frames ===")
        t0 = time.time()
        build_frame_dataset(class_videos)
        print(f"Extraction done in {time.time()-t0:.0f}s")

    print("\n=== Training YOLOv8-cls ===")
    train_yolov8()
    print("\nDone. Model saved → models/yolov5_crime_cls.pt")


if __name__ == "__main__":
    main()
