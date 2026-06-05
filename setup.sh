#!/usr/bin/env bash
# SentinelAI — one-shot setup script
# Works on macOS (Apple Silicon / Intel) and Raspberry Pi OS (64-bit)
#
# Pi mode: installs only the face-recognition detector (no torch, no backend).
#          The backend and frontend are hosted on Railway.
#
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

# ── Disk space check ──────────────────────────────────────────────────────────
FREE_KB=$(df -k . | awk 'NR==2 {print $4}')
FREE_GB=$(awk "BEGIN {printf \"%.1f\", $FREE_KB/1048576}")
REQUIRED_KB=614400   # 600 MB for Pi (slim install), 3 GB for full

if [ "$IS_PI" = true ]; then
    REQUIRED_KB=614400
    echo "Free disk space: ${FREE_GB} GB  (Pi slim install needs ~600 MB)"
else
    REQUIRED_KB=3145728
    echo "Free disk space: ${FREE_GB} GB  (full install needs ~3 GB)"
fi

if [ "$FREE_KB" -lt "$REQUIRED_KB" ]; then
    echo ""
    echo "ERROR: Not enough disk space (${FREE_GB} GB free)."
    echo "Run: sudo apt-get clean && sudo apt-get autoremove -y && rm -rf ~/.cache/pip"
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
        python3-dev \
        python3-pip \
        python3-venv \
        portaudio19-dev \
        libsndfile1 \
        libopencv-dev

    if [ "$IS_PI" = true ]; then
        # dlib and face_recognition via apt — no compilation, no disk spike
        echo "--- Installing dlib + face_recognition via apt (pre-compiled) ---"
        sudo apt-get install -y python3-dlib python3-face-recognition 2>/dev/null || \
            sudo apt-get install -y python3-dlib  # face-recognition installed via pip below
    else
        # Full Linux/macOS: need cmake for dlib source build
        sudo apt-get install -y cmake build-essential \
            libopenblas-dev liblapack-dev libx11-dev libgtk-3-dev ffmpeg
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
    echo "ERROR: No Python 3 found."
    exit 1
fi

echo "Using: $($PYTHON --version)"

if [ ! -d "venv" ]; then
    # On Pi, link system site-packages so apt-installed dlib/face_recognition is visible
    if [ "$IS_PI" = true ]; then
        $PYTHON -m venv venv --system-site-packages
    else
        $PYTHON -m venv venv
    fi
    echo "Created venv/"
else
    echo "venv/ already exists"
fi

PY="$SCRIPT_DIR/venv/bin/python"
"$PY" -m pip install --upgrade pip --quiet --no-cache-dir

# ── Install dependencies ──────────────────────────────────────────────────────
echo ""

if [ "$IS_PI" = true ]; then
    echo "--- Pi slim install: face detector only (backend hosted on Railway) ---"
    "$PY" -m pip install -r "Project Code/ml/requirements-pi.txt" --no-cache-dir --quiet
    "$PY" -m pip install face_recognition --no-cache-dir --quiet 2>/dev/null || true

else
    # Full install: dlib from source if needed, then everything else
    echo "--- Full install: dlib + ML + backend ---"

    if ! "$PY" -c "import dlib" 2>/dev/null; then
        echo "  Building dlib from source (10-20 min)..."
        "$PY" -m pip install dlib --no-cache-dir
    fi

    "$PY" -m pip install face_recognition --no-cache-dir --quiet
    "$PY" -m pip install \
        torch torchvision torchaudio \
        --index-url https://download.pytorch.org/whl/cpu \
        --no-cache-dir --quiet
    "$PY" -m pip install -r "Project Code/ml/requirements.txt" --no-cache-dir --quiet
    "$PY" -m pip install -r "Project Code/backend/requirements.txt" --no-cache-dir --quiet
fi

# ── Clean pip cache ───────────────────────────────────────────────────────────
"$PY" -m pip cache purge 2>/dev/null || true

# ── Verify ───────────────────────────────────────────────────────────────────
echo ""
echo "--- Verifying ---"
"$PY" -c "import face_recognition; print('  face_recognition OK')"
"$PY" -c "import cv2;               print('  opencv OK')"
"$PY" -c "import httpx;             print('  httpx OK')"

echo ""
echo "=== Setup complete! ==="
echo ""

if [ "$IS_PI" = true ]; then
    echo "Pi is configured as an edge detector."
    echo "Make sure your backend URL and token are set, then run:"
    echo ""
    echo "  cd 'Project Code/ml'"
    echo "  ../venv/bin/python intruder_detection.py \\"
    echo "      --api https://your-railway-app.railway.app \\"
    echo "      --token YOUR_JWT_TOKEN"
else
    echo "To start the full system:"
    echo "  source venv/bin/activate"
    echo "  python 'Project Code/start.py'"
fi
echo ""
