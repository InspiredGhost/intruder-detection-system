import numpy as np
import librosa
import torch
import torchaudio.transforms as T

TARGET_SR    = 16000
CHUNK_S      = 1.0       # seconds per inference window
N_MELS       = 128
HOP_LENGTH   = 512
IMG_SIZE     = 224       # EfficientNet input size


def load_audio(path: str) -> np.ndarray:
    """Load WAV or MP3, resample to 16 kHz mono. Returns float32 numpy array."""
    waveform, _ = librosa.load(path, sr=TARGET_SR, mono=True)
    return waveform.astype(np.float32)


def pad_or_trim(waveform: np.ndarray, target_len: int = TARGET_SR) -> np.ndarray:
    if len(waveform) >= target_len:
        return waveform[:target_len]
    return np.pad(waveform, (0, target_len - len(waveform)))


def waveform_to_melspec(waveform: np.ndarray) -> torch.Tensor:
    """
    Convert a 1-second waveform → 3-channel log mel spectrogram tensor (C,H,W)
    sized to IMG_SIZExIMG_SIZE, suitable for EfficientNet input.
    """
    mel = librosa.feature.melspectrogram(
        y=waveform, sr=TARGET_SR, n_mels=N_MELS, hop_length=HOP_LENGTH
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)

    # Normalise to [0, 1]
    log_mel = (log_mel - log_mel.min()) / (log_mel.max() - log_mel.min() + 1e-8)

    # Resize to IMG_SIZE × IMG_SIZE and replicate across 3 channels
    import torch.nn.functional as F
    tensor = torch.tensor(log_mel, dtype=torch.float32).unsqueeze(0).unsqueeze(0)  # (1,1,H,W)
    tensor = F.interpolate(tensor, size=(IMG_SIZE, IMG_SIZE), mode="bilinear", align_corners=False)
    tensor = tensor.squeeze(0).repeat(3, 1, 1)  # (3, IMG_SIZE, IMG_SIZE)
    return tensor


def chunk_waveform(waveform: np.ndarray, duration: float = CHUNK_S) -> list[np.ndarray]:
    """Split waveform into fixed-length chunks (zero-pad the last one)."""
    chunk_len = int(TARGET_SR * duration)
    chunks = []
    for start in range(0, max(len(waveform), chunk_len), chunk_len):
        chunk = waveform[start : start + chunk_len]
        if len(chunk) < chunk_len:
            chunk = np.pad(chunk, (0, chunk_len - len(chunk)))
        chunks.append(chunk)
    return chunks
