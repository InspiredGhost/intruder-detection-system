"""
Pre-download all required pre-trained model weights before training.

Run this once:
    source ../venv/bin/activate
    python download_models.py
"""

from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def download_efficientnet():
    print("--- EfficientNet-B0 (ImageNet, torchvision) ---")
    from torchvision import models
    m = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    print("  EfficientNet-B0 weights downloaded and cached.")


def download_yolov8_cls():
    print("--- YOLOv8s-cls (Ultralytics) ---")
    from ultralytics import YOLO
    YOLO("yolov8s-cls.pt")
    print("  YOLOv8s-cls weights ready.")


def download_yolov8_detector():
    print("--- YOLOv8s object detection (Ultralytics) ---")
    from ultralytics import YOLO
    YOLO("yolov8s.pt")
    print("  YOLOv8s detection weights ready.")


if __name__ == "__main__":
    print("=== Pre-downloading all required model weights ===\n")
    download_efficientnet()
    print()
    download_yolov8_cls()
    print()
    download_yolov8_detector()
    print("\nAll models ready. You can now run train_audio.py and train_video.py.")
