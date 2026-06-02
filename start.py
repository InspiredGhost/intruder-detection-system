#!/usr/bin/env python3
"""
start.py — Run the entire AI Intruder Detection System with one command.
Starts: FastAPI backend · React frontend · ML detection client
Logs:   Color-coded combined output from all three services
Stop:   Ctrl+C shuts everything down cleanly
"""

import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT   = Path(__file__).parent
PYTHON = ROOT / "venv/bin/python"
NPM    = "npm"

R = "\033[0m"
COLORS = {
    "BACKEND":  "\033[36m",
    "FRONTEND": "\033[35m",
    "ML":       "\033[33m",
    "SYSTEM":   "\033[32m",
}

_procs: list[subprocess.Popen] = []


def log(tag: str, msg: str) -> None:
    col = COLORS.get(tag, "")
    print(f"{col}[{tag:<8}]{R} {msg}", flush=True)


def _stream(proc: subprocess.Popen, tag: str) -> None:
    try:
        for line in proc.stdout:  # type: ignore[union-attr]
            log(tag, line.rstrip())
    except Exception:
        pass


def _start(tag: str, cmd: list[str], cwd: Path) -> subprocess.Popen:
    log("SYSTEM", f"Starting {tag} …")
    proc = subprocess.Popen(
        cmd, cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True, bufsize=1,
    )
    _procs.append(proc)
    threading.Thread(target=_stream, args=(proc, tag), daemon=True).start()
    return proc


def _stop_all(sig=None, frame=None) -> None:
    log("SYSTEM", "Stopping all services …")
    for p in _procs:
        try:
            p.terminate()
        except Exception:
            pass
    time.sleep(2)
    for p in _procs:
        try:
            p.kill()
        except Exception:
            pass
    log("SYSTEM", "All services stopped.")
    sys.exit(0)


signal.signal(signal.SIGINT,  _stop_all)
signal.signal(signal.SIGTERM, _stop_all)

if __name__ == "__main__":
    # Read device config for ML startup args
    import json
    config_path = ROOT / "device_config.json"
    if config_path.exists():
        cfg = json.loads(config_path.read_text())
    else:
        cfg = {"camera_index": 0, "audio_device": 4}
        config_path.write_text(json.dumps(cfg, indent=2))

    log("SYSTEM", "=" * 58)
    log("SYSTEM", "  AI Intruder Detection System")
    log("SYSTEM", "=" * 58)
    log("SYSTEM", f"  Camera device : {cfg['camera_index']}")
    log("SYSTEM", f"  Audio device  : {cfg['audio_device']}")
    log("SYSTEM", "=" * 58)

    # 1 — Backend
    _start("BACKEND", [
        str(PYTHON), "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0", "--port", "8000", "--reload",
    ], ROOT / "backend")
    time.sleep(3)

    # 2 — Frontend
    _start("FRONTEND", [NPM, "run", "dev"], ROOT / "frontend")
    time.sleep(1)

    # 3 — ML client
    _start("ML", [
        str(PYTHON), "intruder_detection.py",
        "--camera",       str(cfg["camera_index"]),
        "--audio-device", str(cfg["audio_device"]),
    ], ROOT / "ml")

    log("SYSTEM", "")
    log("SYSTEM", "  Backend  → http://localhost:8000")
    log("SYSTEM", "  Frontend → http://localhost:3000")
    log("SYSTEM", "  API docs → http://localhost:8000/docs")
    log("SYSTEM", "")
    log("SYSTEM", "  Press Ctrl+C to stop everything.")
    log("SYSTEM", "")

    while True:
        time.sleep(5)
        for p in list(_procs):
            if p.poll() is not None:
                _procs.remove(p)
                log("SYSTEM", f"A service exited (code {p.returncode})")
