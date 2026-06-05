"""Quick test — shows live audio model probabilities. Play sounds while this runs."""
import sys
import time
import sounddevice as sd
import torch
import torch.nn as nn
from torchvision import models
from utils.audio_utils import pad_or_trim, waveform_to_melspec, TARGET_SR

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
AUDIO_DEVICE = int(sys.argv[1]) if len(sys.argv) > 1 else 1

model = models.efficientnet_b0(weights=None)
in_f = model.classifier[1].in_features
model.classifier = nn.Sequential(nn.Dropout(0.3), nn.Linear(in_f, 1))
model.load_state_dict(torch.load("models/audio_classifier.pt", map_location=DEVICE))
model.to(DEVICE).eval()

print(f"Listening on device {AUDIO_DEVICE} for 20s — play sounds now...")
print(f"Device: {DEVICE}  |  Sample rate: {TARGET_SR}  |  Threshold: 0.50\n")

def callback(indata, frames, t, status):
    chunk = pad_or_trim(indata[:, 0].copy(), TARGET_SR)
    spec = waveform_to_melspec(chunk).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        prob = float(torch.sigmoid(model(spec).squeeze()).cpu())
    bar = "#" * int(prob * 40)
    tag = "  <-- ALERT" if prob > 0.50 else ""
    print(f"prob={prob:.4f}  [{bar:<40}]{tag}")

with sd.InputStream(samplerate=TARGET_SR, channels=1, dtype="float32",
                    blocksize=int(TARGET_SR * 1.0), device=AUDIO_DEVICE, callback=callback):
    time.sleep(20)

print("Done.")
