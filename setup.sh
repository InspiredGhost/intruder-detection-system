#!/usr/bin/env bash
# SentinelAI — one-shot setup script
# Works on macOS (Apple Silicon / Intel) and Raspberry Pi OS (64-bit)
# Usage: bash setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=== SentinelAI Setup ==="
echo ""

# ── Detect platform ───────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
IS_PI=false
if [ "$OS" = "Linux" ] && ([ "$ARCH" = "aarch64" ] || grep -qi "raspberry" /proc/device-tree/model 2>/dev/null); then
    IS_PI=true
fi

echo "Platform: $OS / $ARCH  (Raspberry Pi: $IS_PI)"

# ── Disk space check (need at least 3 GB free) ────────────────────────────────
FREE_KB=$(df -k . | awk 'NR==2 {print $4}')
FREE_GB=$(awk "BEGIN {printf \"%.1f\", $FREE_KB/1048576}")
echo "Free disk space: ${FREE_GB} GB"
if [ "$FREE_KB" -lt 3145728 ]; then
    echo ""
    echo "ERROR: Not enough disk space (${FREE_GB} GB free, need at least 3 GB)."
    echo "Free up space then re-run this script."
    echo ""
    echo "Quick cleanup tips:"
    echo "  sudo apt-get clean"
    echo "  sudo apt-get autoremove -y"
    echo "  rm -rf ~/.cache/pip"
    exit 1
fi

# ── System dependencies ───────────────────────────────────────────────────────
echo ""
echo "--- Installing system dependencies ---"

if [ "$OS" = "Darwin" ]; then
    if ! command -v brew &>/dev/null; then
        echo "ERROR: Homebrew not found. Install it from https://brew.sh first."
        exit 1
    fi
    brew install cmake portaudio 2>/dev/null || true

elif [ "$IS_PI" = true ] || [ "$OS" = "Linux" ]; then
    sudo apt-get update -qq
    sudo apt-get install -y \
        cmake \
        build-essential \
        libopenblas-dev \
        liblapack-dev \
        libx11-dev \
        libgtk-3-dev \
        python3-dev \
        python3-pip \
        python3-venv \
        portaudio19-dev \
        libsndfile1 \
        ffmpeg

    # ── Increase swap to 2 GB so dlib can compile without OOM ────────────────
    # dlib C++ compilation needs ~1 GB RAM; Pi default swap is only 100 MB
    if [ "$IS_PI" = true ]; then
        echo ""
        echo "--- Increasing swap to 2 GB for dlib compilation ---"
        SWAP_FILE=/etc/dphys-swapfile
        if [ -f "$SWAP_FILE" ]; then
            sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' "$SWAP_FILE"
            sudo dphys-swapfile setup
            sudo dphys-swapfile swapon
            echo "  Swap set to 2048 MB"
        else
            # Fallback: manual swapfile
            if [ ! -f /swapfile ]; then
                sudo fallocate -l 2G /swapfile
                sudo chmod 600 /swapfile
                sudo mkswap /swapfile
            fi
            sudo swapon /swapfile 2>/dev/null || true
            echo "  Swapfile activated (2 GB)"
        fi
    fi
fi

# ── Python virtual environment ────────────────────────────────────────────────
echo ""
echo "--- Setting up Python virtual environment ---"

PYTHON=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" &>/dev/null; then
        PYTHON="$candidate"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo "ERROR: No suitable Python 3 interpreter found."
    exit 1
fi

echo "Using: $($PYTHON --version)"

if [ ! -d "venv" ]; then
    $PYTHON -m venv venv
    echo "Created venv/"
else
    echo "venv/ already exists — upgrading..."
    $PYTHON -m venv venv --upgrade
fi

PY="$SCRIPT_DIR/venv/bin/python"

# ── Upgrade pip ───────────────────────────────────────────────────────────────
"$PY" -m pip install --upgrade pip --quiet --no-cache-dir

# ── dlib — install separately first (largest build step) ─────────────────────
echo ""
echo "--- Installing dlib (compiles from source, takes 10-20 min on Pi) ---"

if "$PY" -c "import dlib" 2>/dev/null; then
    echo "  dlib already installed — skipping"
else
    # Try pre-built wheel first (much faster, no compilation)
    if "$PY" -m pip install dlib --only-binary=dlib --no-cache-dir --quiet 2>/dev/null; then
        echo "  dlib installed from pre-built wheel"
    else
        echo "  No pre-built wheel found — compiling from source..."
        echo "  This will take 10-20 minutes on a Raspberry Pi. Please wait."
        "$PY" -m pip install dlib --no-cache-dir
    fi
fi

# ── face_recognition ─────────────────────────────────────────────────────────
echo ""
echo "--- Installing face_recognition ---"
"$PY" -m pip install face_recognition --no-cache-dir --quiet

# ── ML dependencies ──────────────────────────────────────────────────────────
echo ""
echo "--- Installing ML dependencies ---"

if [ "$IS_PI" = true ]; then
    # CPU-only PyTorch for Pi (no CUDA)
    "$PY" -m pip install \
        torch torchvision torchaudio \
        --index-url https://download.pytorch.org/whl/cpu \
        --no-cache-dir --quiet
fi

# Install remaining ML deps (skip dlib/face_recognition — already done above)
"$PY" -m pip install \
    ultralytics librosa sounddevice soundfile \
    opencv-python scikit-learn numpy requests \
    tqdm Pillow httpx \
    --no-cache-dir --quiet

# ── Backend dependencies ──────────────────────────────────────────────────────
echo ""
echo "--- Installing backend dependencies ---"
"$PY" -m pip install -r backend/requirements.txt --no-cache-dir --quiet

# ── Clean up pip cache to reclaim disk space ─────────────────────────────────
echo ""
echo "--- Cleaning pip cache ---"
"$PY" -m pip cache purge 2>/dev/null || true
echo "  Cache cleared"

# ── Verify key packages ───────────────────────────────────────────────────────
echo ""
echo "--- Verifying installation ---"
"$PY" -c "import face_recognition; print('  face_recognition OK')"
"$PY" -c "import cv2;               print('  opencv OK')"
"$PY" -c "import fastapi;           print('  fastapi OK')"
"$PY" -c "import torch;             print('  torch OK')"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start the system:"
echo "  source venv/bin/activate"
echo "  python start.py"
echo ""
