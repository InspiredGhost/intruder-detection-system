# Intruder Detection — Web App (React + TypeScript + Tailwind)

## Overview
React dashboard for monitoring the intruder detection system. Shows a live MJPEG video feed, real-time alerts via WebSocket, and a browsable alert history.

## Pages

- **`/login`** — JWT login form
- **`/dashboard`** — Live stream, status indicator, and alert list

## Features

- MJPEG live stream from `/stream` (updates when detector is running)
- WebSocket connection to `/ws/alerts` — new alerts appear instantly without polling
- Browser push notifications for non-normal events (requires user permission)
- Falls back to 5-second polling if WebSocket is unavailable
- Automatic redirect to login on 401

## Setup

```bash
cd frontend
npm install
```

## Run (development)

The Vite dev server proxies all API and WebSocket traffic to `http://localhost:8000`.

```bash
npm run dev        # http://localhost:3000
```

Make sure the FastAPI backend is running first.

## Build (production)

```bash
npm run build      # outputs to dist/
```

Deploy the `dist/` folder to Vercel, Netlify, or any static host. Point the API base URL to your deployed backend.
