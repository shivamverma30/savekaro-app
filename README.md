# SaveKaro - All Video Downloader

SaveKaro is a full-stack video downloader web application that extracts media metadata and provides downloadable formats using yt-dlp.

Live URL: https://savekaro-sv.vercel.app/

## Overview

This repository contains:
- Frontend: React + Vite app for URL input, format listing, and browser download flow.
- Backend: Express API that extracts format metadata and streams downloaded files.
- Mobile: Placeholder directory for future mobile app work.

The app is designed for a simple user flow:
1. Paste a public video URL.
2. Extract available formats.
3. Choose a format.
4. Download media directly from the browser.

## Key Features

- Multi-platform URL extraction via yt-dlp.
- Format-wise download options (quality, extension, resolution, file size).
- Binary streaming download endpoint from backend.
- Friendly API error handling for private/login-required/temporary blocked content.
- CORS configuration for local and deployed clients.
- Global API rate limiting.
- Temporary file cleanup for server storage hygiene.
- Production-safe Express middleware setup with centralized error handling.

## Tech Stack

### Frontend
- React 19
- Vite 8
- Axios
- React Icons

### Backend
- Node.js + Express 5
- yt-dlp-exec
- express-rate-limit
- cors
- morgan
- dotenv

### Tooling
- ESLint (frontend)
- Nodemon (backend development)

## Monorepo Structure

```text
all-video-downloader/
  backend/
    src/
      controllers/
      middleware/
      routes/
      services/
      utils/
      temp/
  frontend/
    src/
      api/
      components/
      utils/
  mobile/
```

## API Endpoints

Base URL (local): `http://localhost:5000`

- `GET /`
  - Health endpoint.
  - Returns service status, environment, uptime, timestamp.

- `POST /api/v1/downloader/extract`
  - Extracts media metadata and available formats.
  - Request body:
    ```json
    {
      "url": "https://example.com/video"
    }
    ```

- `POST /api/v1/downloader/download`
  - Downloads selected format and streams file as binary.
  - Request body:
    ```json
    {
      "url": "https://example.com/video",
      "format_id": "18"
    }
    ```

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JSON_LIMIT=1mb
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=120

# Optional: ffmpeg custom locations
FFMPEG_PATH=
FFMPEG_LOCATION=
FFMPEG_BINARY=
```

Notes:
- `CLIENT_URL` supports comma-separated origins.
- Backend auto-adds `http://localhost:5173` to allowed origins.

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
```

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm
- ffmpeg recommended on server for best merge/format compatibility

### 1) Backend Setup

```bash
cd backend
npm install
npm run dev
```

Backend runs on: `http://localhost:5000`

### 2) Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

## Production / Deployment Notes

Live frontend is hosted at:
- https://savekaro-sv.vercel.app/

Important behavior observed in deployment:
- YouTube downloads may be blocked intermittently in hosted environment.
- Instagram may also be blocked in some cases.
- Facebook links are working more reliably.
- On localhost, all currently supported flows work as expected.

Possible reasons:
- Platform anti-bot/rate-limit controls.
- Region/network level restrictions.
- Host environment differences (binary/network/cookies/runtime constraints).

## Current Limitations

- Some platforms may require login, cookies, or fail due to temporary blocking.
- Availability can vary by source platform and deployment environment.
- Download success depends on current extractor compatibility of yt-dlp for the URL.

## Future Roadmap

- Build and release a dedicated mobile APK for Android.
- Improve reliability for blocked platforms in hosted deployments.
- Add retry intelligence and platform-specific fallback strategies.
- Add analytics and download job observability.

## Scripts

### Backend
- `npm run dev` - Run backend with Nodemon.
- `npm start` - Run backend in production mode.

### Frontend
- `npm run dev` - Start Vite dev server.
- `npm run build` - Build production frontend.
- `npm run preview` - Preview production build locally.
- `npm run lint` - Run ESLint checks.

## Security and Compliance Note

Use this project responsibly and only for content you have rights/permission to download.
Platform terms of service and regional regulations may apply.

## Author

Shivam Verma
