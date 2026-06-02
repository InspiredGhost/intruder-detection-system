# Intruder Detection — Backend (FastAPI + MongoDB)

## Overview
FastAPI service that stores detection events from the Raspberry Pi detector, serves them to the web dashboard, and streams live video via MJPEG.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/token` | — | Login, returns JWT |
| POST | `/predict` | Bearer | Store a detection alert |
| GET | `/alerts` | Bearer | Fetch 50 most recent alerts |
| POST | `/stream/frame` | Bearer | Push a JPEG frame (detector → backend) |
| GET | `/stream?token=JWT` | query | MJPEG live stream |
| WS | `/ws/alerts?token=JWT` | query | Real-time alert WebSocket |
| GET | `/health` | — | Health check |

## Setup

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```env
MONGODB_URI=mongodb://...
JWT_SECRET=your_long_random_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
```

## Run

```bash
uvicorn main:app --reload
```

API docs available at http://localhost:8000/docs
