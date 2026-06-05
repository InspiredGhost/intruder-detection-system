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

# ── Detect platform ──────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
IS_PI=false
if [ "$OS" = "Linux" ] && ([ "$ARCH" = "aarch64" ] || grep -qi "raspberry" /proc/device-tree/model 2>/dev/null); then
    IS_PI=true
fi

echo "Platform: $OS / $ARCH  (Raspberry Pi: $IS_PI)"

# ── System dependencies ───────────────────────────────────────────────────────
echo ""
echo "--- Installing system dependencies ---"

if [ "$OS" = "Darwin" ]; then
    # macOS — requires Homebrew
    if ! command -v brew &>/dev/null; then
        echo "ERROR: Homebrew not found. Install it from https://brew.sh first."
        exit 1
    fi
    brew install cmake portaudio 2>/dev/null || true

elif [ "$IS_PI" = true ] || [ "$OS" = "Linux" ]; then
    sudo apt-get update -qq
    # cmake + build tools for dlib
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
fi

# ── Python virtual environment ────────────────────────────────────────────────
echo ""
echo "--- Setting up Python virtual environment ---"

PYTHON=""
for candidate in python3.13 python3.12 python3.11 python3; do
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
"$PY" -m pip install --upgrade pip --quiet

# ── ML dependencies ──────────────────────────────────────────────────────────
echo ""
echo "--- Installing ML dependencies (may take several minutes for dlib) ---"

if [ "$IS_PI" = true ]; then
    # On Pi, install torch CPU-only build (smaller, no CUDA)
    "$PY" -m pip install \
        torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu \
        --quiet
fi

"$PY" -m pip install -r ml/requirements.txt

# ── Backend dependencies ──────────────────────────────────────────────────────
echo ""
echo "--- Installing backend dependencies ---"
"$PY" -m pip install -r backend/requirements.txt

# ── Verify face_recognition ──────────────────────────────────────────────────
echo ""
echo "--- Verifying face_recognition ---"
"$PY" -c "import face_recognition; print('  face_recognition OK')"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start the system:"
echo "  source venv/bin/activate"
echo "  python start.py"
echo ""
