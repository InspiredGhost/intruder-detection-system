"""
Fine-tune EfficientNet-B0 for binary intrusion sound detection.

Architecture:
  Audio waveform → log mel spectrogram (128 mels) → resized to 224×224 →
  EfficientNet-B0 (ImageNet pre-trained) → binary head (intrusion / normal)

Checkpointing:
  A checkpoint is saved after every epoch to models/audio_checkpoint.pt.
  If the script is interrupted and re-run, it automatically resumes from
  the last completed epoch — no data is lost.

Usage:
    source ../venv/bin/activate
    python train_audio.py
"""

import os
import time
import zipfile
from pathlib import Path

import numpy as np
import requests
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models
from sklearn.model_selection import train_test_split
from tqdm import tqdm

from utils.audio_utils import load_audio, pad_or_trim, waveform_to_melspec

# ---------------------------------------------------------------------------
# Paths & hyper-parameters
# ---------------------------------------------------------------------------
BASE_DIR        = Path(__file__).parent
DATA_DIR        = BASE_DIR.parent / "data" / "audio" / "gunshot"
CACHE_DIR       = BASE_DIR / "data_cache"
MODEL_OUT       = BASE_DIR / "models" / "audio_classifier.pt"
CHECKPOINT_PATH = BASE_DIR / "models" / "audio_checkpoint.pt"

ESC50_DIR = CACHE_DIR / "ESC-50"
US8K_DIR  = CACHE_DIR / "UrbanSound8K"
MIVIA_DIR = CACHE_DIR / "MIVIA"

ESC50_URL = "https://github.com/karoldvl/ESC-50/archive/master.zip"

EPOCHS     = 20
BATCH_SIZE = 32
LR         = 1e-4
VAL_SPLIT  = 0.15
TEST_SPLIT = 0.15
DEVICE     = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"


# ---------------------------------------------------------------------------
# Dataset helpers
# ---------------------------------------------------------------------------

def _download(url: str, dest: Path, desc: str = ""):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return
    print(f"Downloading {desc}...")
    r = requests.get(url, stream=True)
    total = int(r.headers.get("content-length", 0))
    with open(dest, "wb") as f, tqdm(total=total, unit="B", unit_scale=True, desc=desc) as bar:
        for chunk in r.iter_content(8192):
            f.write(chunk)
            bar.update(len(chunk))


def get_esc50_normals() -> list[Path]:
    audio_dir = ESC50_DIR / "ESC-50-master" / "audio"
    if not audio_dir.exists():
        zip_path = ESC50_DIR / "esc50.zip"
        _download(ESC50_URL, zip_path, "ESC-50")
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(ESC50_DIR)
        zip_path.unlink(missing_ok=True)
    files = list(audio_dir.glob("*.wav"))
    print(f"  ESC-50: {len(files)} normal files")
    return files


def get_urbansound8k_normals() -> list[Path]:
    audio_root = US8K_DIR / "audio"
    if not audio_root.exists():
        print("  [UrbanSound8K] Not found — skipping. Download from urbansounddataset.weebly.com")
        return []
    US8K_NORMAL = {0, 1, 2, 3, 4, 5, 7, 8, 9}
    files = [
        p for p in audio_root.rglob("*.wav")
        if len(p.stem.split("-")) >= 2 and int(p.stem.split("-")[1]) in US8K_NORMAL
    ]
    print(f"  UrbanSound8K: {len(files)} normal files")
    return files


def get_mivia_positives() -> list[Path]:
    if not MIVIA_DIR.exists():
        print("  [MIVIA] Not found — skipping. Request at mivia.unisa.it")
        return []
    files = list(MIVIA_DIR.rglob("*.wav"))
    print(f"  MIVIA: {len(files)} intrusion files")
    return files


def collect_data() -> tuple[list[Path], list[int]]:
    paths, labels = [], []

    print("\n=== Intrusion (positive) samples ===")
    for p in list(DATA_DIR.rglob("*.wav")) + list(DATA_DIR.rglob("*.mp3")):
        paths.append(p); labels.append(1)
    print(f"  Gunshot data: {labels.count(1)} files")
    for p in get_mivia_positives():
        paths.append(p); labels.append(1)

    print("\n=== Normal (negative) samples ===")
    negatives = get_esc50_normals() + get_urbansound8k_normals()
    n_pos = labels.count(1)
    rng = np.random.default_rng(42)
    chosen = rng.choice(len(negatives), size=min(len(negatives), n_pos * 2), replace=False)
    for i in chosen:
        paths.append(negatives[i]); labels.append(0)

    print(f"\nTotal: {labels.count(1)} intrusion, {labels.count(0)} normal")
    return paths, labels


# ---------------------------------------------------------------------------
# PyTorch Dataset
# ---------------------------------------------------------------------------

class AudioDataset(Dataset):
    def __init__(self, paths: list[Path], labels: list[int]):
        self.paths  = paths
        self.labels = labels

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        try:
            wav = load_audio(str(self.paths[idx]))
            wav = pad_or_trim(wav)
            spec = waveform_to_melspec(wav)
        except Exception:
            spec = torch.zeros(3, 224, 224)
        return spec, torch.tensor(self.labels[idx], dtype=torch.float32)


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

def build_model() -> nn.Module:
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(in_features, 1),
    )
    return model


# ---------------------------------------------------------------------------
# Training / eval loops with per-batch progress
# ---------------------------------------------------------------------------

def train_epoch(model, loader, optimizer, criterion, epoch, total_epochs):
    model.train()
    total_loss, correct, n = 0.0, 0, 0
    bar = tqdm(loader, desc=f"Epoch {epoch:02d}/{total_epochs} [train]", leave=False, unit="batch")
    for specs, labels in bar:
        specs, labels = specs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        out = model(specs).squeeze(1)
        loss = criterion(out, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * len(labels)
        correct += ((out.sigmoid() > 0.5) == labels.bool()).sum().item()
        n += len(labels)
        bar.set_postfix(loss=f"{total_loss/n:.4f}", acc=f"{correct/n:.3f}")
    return total_loss / n, correct / n


@torch.no_grad()
def eval_epoch(model, loader, criterion, desc="val"):
    model.eval()
    total_loss, correct, n = 0.0, 0, 0
    bar = tqdm(loader, desc=f"  [{desc}]", leave=False, unit="batch")
    for specs, labels in bar:
        specs, labels = specs.to(DEVICE), labels.to(DEVICE)
        out = model(specs).squeeze(1)
        loss = criterion(out, labels)
        total_loss += loss.item() * len(labels)
        correct += ((out.sigmoid() > 0.5) == labels.bool()).sum().item()
        n += len(labels)
        bar.set_postfix(loss=f"{total_loss/n:.4f}", acc=f"{correct/n:.3f}")
    return total_loss / n, correct / n


# ---------------------------------------------------------------------------
# Checkpoint helpers
# ---------------------------------------------------------------------------

def save_checkpoint(epoch, model, optimizer, scheduler, best_val_acc, patience_count):
    torch.save({
        "epoch":                epoch,
        "model_state_dict":     model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_state_dict": scheduler.state_dict(),
        "best_val_acc":         best_val_acc,
        "patience_count":       patience_count,
    }, CHECKPOINT_PATH)


def load_checkpoint(model, optimizer, scheduler):
    if not CHECKPOINT_PATH.exists():
        return 1, 0.0, 0   # start_epoch, best_val_acc, patience_count

    print(f"\n>>> Checkpoint found: {CHECKPOINT_PATH}")
    ckpt = torch.load(CHECKPOINT_PATH, map_location=DEVICE)
    model.load_state_dict(ckpt["model_state_dict"])
    optimizer.load_state_dict(ckpt["optimizer_state_dict"])
    scheduler.load_state_dict(ckpt["scheduler_state_dict"])
    start_epoch    = ckpt["epoch"] + 1
    best_val_acc   = ckpt["best_val_acc"]
    patience_count = ckpt["patience_count"]
    print(f">>> Resuming from epoch {start_epoch}/{EPOCHS}  |  best val acc so far: {best_val_acc:.4f}\n")
    return start_epoch, best_val_acc, patience_count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"\n{'='*60}")
    print(f"  Audio Classifier Training — EfficientNet-B0")
    print(f"  Device : {DEVICE}")
    print(f"  Epochs : {EPOCHS}   Batch : {BATCH_SIZE}   LR : {LR}")
    print(f"{'='*60}\n")

    paths, labels = collect_data()
    labels_arr = np.array(labels)
    idx = np.arange(len(labels))
    idx_tv, idx_test = train_test_split(idx, test_size=TEST_SPLIT, stratify=labels_arr, random_state=42)
    idx_train, idx_val = train_test_split(
        idx_tv, test_size=VAL_SPLIT / (1 - TEST_SPLIT), stratify=labels_arr[idx_tv], random_state=42
    )

    print(f"\nSplit: {len(idx_train)} train  |  {len(idx_val)} val  |  {len(idx_test)} test\n")

    train_ds = AudioDataset([paths[i] for i in idx_train], [labels[i] for i in idx_train])
    val_ds   = AudioDataset([paths[i] for i in idx_val],   [labels[i] for i in idx_val])
    test_ds  = AudioDataset([paths[i] for i in idx_test],  [labels[i] for i in idx_test])

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=2, persistent_workers=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=2, persistent_workers=True)
    test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False, num_workers=2, persistent_workers=True)

    model     = build_model().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)
    criterion = nn.BCEWithLogitsLoss()

    start_epoch, best_val_acc, patience_count = load_checkpoint(model, optimizer, scheduler)

    if start_epoch > EPOCHS:
        print("Training already complete. Delete models/audio_checkpoint.pt to retrain.")
        return

    epoch_times = []
    for epoch in range(start_epoch, EPOCHS + 1):
        t0 = time.time()

        tr_loss, tr_acc = train_epoch(model, train_loader, optimizer, criterion, epoch, EPOCHS)
        vl_loss, vl_acc = eval_epoch(model, val_loader, criterion, desc="val")
        scheduler.step(vl_loss)

        elapsed = time.time() - t0
        epoch_times.append(elapsed)
        remaining = (EPOCHS - epoch) * (sum(epoch_times) / len(epoch_times))
        eta = f"{int(remaining//3600):02d}h{int((remaining%3600)//60):02d}m"

        marker = " ✓ best" if vl_acc > best_val_acc else ""
        print(
            f"Epoch {epoch:02d}/{EPOCHS} | "
            f"train loss {tr_loss:.4f} acc {tr_acc:.3f} | "
            f"val loss {vl_loss:.4f} acc {vl_acc:.3f} | "
            f"{elapsed:.0f}s | ETA {eta}{marker}"
        )

        if vl_acc > best_val_acc:
            best_val_acc = vl_acc
            torch.save(model.state_dict(), MODEL_OUT)
            patience_count = 0
        else:
            patience_count += 1
            if patience_count >= 5:
                print("Early stopping.")
                break

        save_checkpoint(epoch, model, optimizer, scheduler, best_val_acc, patience_count)

    print("\n=== Final evaluation on test set ===")
    model.load_state_dict(torch.load(MODEL_OUT, map_location=DEVICE))
    _, test_acc = eval_epoch(model, test_loader, criterion, desc="test")
    print(f"Test accuracy : {test_acc:.4f}")
    print(f"Model saved   → {MODEL_OUT}")
    print(f"Checkpoint    → {CHECKPOINT_PATH}  (safe to delete)\n")


if __name__ == "__main__":
    main()
