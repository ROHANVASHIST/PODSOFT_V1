# Mobile Streaming — Overview

This document covers the end-to-end implementation of the mobile-to-studio live streaming feature in PodSoft, including the problems encountered during development, how they were resolved, and how the system currently works.

## Table of Contents

- [Quick Start](./README.md#quick-start)
- [Tech Stack](./README.md#tech-stack)
- [Architecture](./architecture.md)
- [Mobile App](./frontend.md)
- [API Server](./backend.md)
- [Environment Config](./environment.md)

---

## Quick Start

### Prerequisites
- Android device or emulator on the same Wi-Fi network as the dev machine
- API server running on port `3001`
- Studio web app running on port `3000`

### Run locally (dev client)

```bash
# 1. Start the API server
cd apps/api
npx ts-node server.ts

# 2. Start the studio
cd apps/web
npm run dev

# 3. Start Expo dev server
cd apps/mobile
npx expo start
```

Scan the QR code with the Expo dev client app. The signaling server URL is auto-detected from `hostUri` — no IP config needed.

### Build a preview APK

```bash
cd apps/mobile
eas build --profile preview --platform android --local
```

Set `SIGNALING_SERVER_URL` in `eas.json` → `preview.env` to your machine's LAN IP before building.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Mobile app | React Native (Expo SDK 54) | Camera, UI, streaming client |
| Camera preview | `react-native-vision-camera` v4 | Viewfinder, local recording |
| WebRTC stream | `react-native-webrtc` | P2P video/audio to studio |
| Signaling | Socket.io (via `@podsoft/shared`) | Room join, offer/answer/ICE relay |
| State | Zustand v5 | Camera, recording, streaming, session stores |
| Studio | React + Vite | Receives and displays the mobile stream |
| API server | Node.js + Express + Socket.io | Signaling relay, REST endpoints |
| Shared types | `@podsoft/shared` | Socket event names, payload types |
