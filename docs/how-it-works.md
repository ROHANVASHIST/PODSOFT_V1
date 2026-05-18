# PodSoft — How It Works

A practical guide to the system architecture and how to connect the mobile app to the web studio.

---

## System Overview

PodSoft is a monorepo with three apps that work together:

```
┌─────────────────┐     Socket.io signaling      ┌─────────────────┐
│   Mobile App    │ ◄──────────────────────────► │   API Server    │
│  (Producer)     │                               │  (Relay + API)  │
│  Expo / RN      │     Socket.io signaling      │  Node + Express │
│                 │ ◄──────────────────────────► │                 │
└────────┬────────┘                               └────────┬────────┘
         │                                                 │
         │          WebRTC P2P (direct)                    │
         └─────────────────────────────────────────────────┘
                                                           │
                                          Socket.io signaling
                                                           │
                                                 ┌─────────▼────────┐
                                                 │   Web Studio     │
                                                 │  (Consumer)      │
                                                 │  React + Vite    │
                                                 └──────────────────┘
```

| App | Location | Role |
|---|---|---|
| **API Server** | `apps/api` | Signaling relay, chunk storage, AI endpoints |
| **Web Studio** | `apps/web` | OBS-style broadcast center, WebRTC consumer |
| **Mobile App** | `apps/mobile` | Smart camera, WebRTC producer |

The API server never touches the video stream. It only relays small signaling messages (offer, answer, ICE candidates) to help the mobile and studio establish a direct peer-to-peer WebRTC connection. Once connected, video flows directly between devices.

---

## Connection Flow — Step by Step

### 1. Studio loads

When you open the web studio and sign in:

- Supabase auth runs, your studio record is loaded (or created)
- A **Room Code** is generated: `PS-XXXX` (first 4 chars of your studio ID, uppercased)
- The studio connects to the API server via Socket.io and joins a room using that code
- The QR code panel in the DroidCam modal displays the room code

### 2. Mobile opens

When you open the mobile app:

- The **Pairing Overlay** appears immediately
- You type the room code shown in the studio (e.g. `PS-8A3F`)
- The mobile connects to the same API server and joins the same room as a `producer`

### 3. Server pairs them

When both clients are in the same room:

- The API server emits a `PAIRED` event to everyone in the room
- **Studio**: the menu bar badge turns green — `Mobile: Live`
- **Mobile**: the pairing overlay dismisses and WebRTC starts automatically

### 4. WebRTC handshake

The mobile initiates the connection:

```
Mobile  →  SIGNAL(offer)   →  API Server  →  Studio
Studio  →  SIGNAL(answer)  →  API Server  →  Mobile
Both    →  SIGNAL(candidate) → API Server → Other side
```

All of this happens in under a second on a local network. Once ICE negotiation completes, the video stream is peer-to-peer — the API server is no longer involved.

### 5. Video appears in studio

- A **Mobile Camera** source is automatically added to the top of the active scene's source list
- The video renders in the source panel and the canvas
- You can reorder, resize, or apply filters to it like any other source

### 6. Recording

Two independent recording paths exist:

**Studio records the composed scene:**
- Click **Start Recording** in the Controls Dock
- The studio captures the canvas (all visible sources composited) via `MediaRecorder`
- Every 30 seconds a chunk is uploaded to Supabase Storage
- When you click **Stop Recording**, the chunks are stitched into `final.webm` and a download link appears in the File view

**Studio triggers the mobile to record natively:**
- Click **Record Mobile** in the Controls Dock (only active when mobile is connected)
- The mobile's Vision Camera starts recording in native H.264/HEVC
- The video is saved to the device gallery in the **PodSoft** album
- Click **Stop Mobile Rec** to stop

### 7. Session ends

- Click **Stop Stream** on the mobile, or close the app
- The mobile-camera source disappears from the studio automatically
- The menu bar badge resets to show the room code

---

## Running the Stack Locally

### Prerequisites

- Node.js v22+
- npm v10+
- A physical Android device (WebRTC and Vision Camera don't work in the Expo Go simulator)
- Both your dev machine and phone on the **same Wi-Fi network**

### 1. Install dependencies

```bash
# from the monorepo root
npm install
```

### 2. Configure the mobile server URL

Open `apps/mobile/app.json` and set `signalingServerUrl` to your machine's local IP:

```json
"extra": {
  "signalingServerUrl": "http://192.168.1.X:3001"
}
```

Find your IP on Windows: `ipconfig` → look for IPv4 Address under your Wi-Fi adapter.

### 3. Configure environment variables

**`apps/api/.env`**
```env
PORT=3001
GEMINI_API_KEY=your-gemini-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxx
```

**`apps/web/.env`**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
```

### 4. Start everything

```bash
npx turbo run dev
```

Or individually:

```bash
npm run dev:api     # API server on port 3001
npm run dev:web     # Web studio on port 3000 (proxies /api and /socket.io to 3001)
npm run dev:mobile  # Expo dev server
```

### 5. Build and install the mobile app

The mobile app requires a development build (not Expo Go):

```bash
cd apps/mobile
npx eas build --profile development --platform android
```

Install the resulting APK on your device, then start it with:

```bash
npm run dev:mobile
```

---

## Architecture Details

### Shared package (`packages/shared`)

Single source of truth for the Socket.io contract. Both the web studio and mobile app import from here:

```typescript
import { io, SOCKET_EVENTS, type Socket } from '@podsoft/shared';
```

Key exports:

| Export | Purpose |
|---|---|
| `SOCKET_EVENTS` | All event name constants — prevents string typos |
| `JoinRoomPayload` | `{ roomId: string, role: 'producer' \| 'studio' }` |
| `SignalPayload` | WebRTC signal wrapper type |
| `CommandPayload` | Remote camera command type |
| `CommandType` | `SET_ZOOM \| TOGGLE_TORCH \| SWITCH_CAMERA \| SET_EXPOSURE \| START_RECORDING \| STOP_RECORDING` |

### API server (`apps/api`)

Stateless relay — it never stores video or audio. Key responsibilities:

- **Signaling relay**: joins clients into Socket.io rooms, relays `SIGNAL` and `COMMAND` events between them, emits `PAIRED` when ≥2 clients are in a room
- **Chunk storage**: receives 30-second WebM chunks from the studio and uploads them to Supabase Storage
- **Finalize**: stitches chunks into a single `final.webm`, generates a signed download URL
- **AI endpoints**: Gemini-powered scene analysis, script generation, layout generation
- **Proxy**: forwards DroidCam MJPEG streams to bypass browser Mixed Content restrictions

### Web studio (`apps/web`)

OBS-style interface built with React 19 + Vite + Tailwind v4. Key concepts:

- **Scenes and sources**: scenes are stored in Supabase, sources are local state (streams don't survive a page refresh by design)
- **WebRTC consumer**: `setupPeerConnection()` creates an `RTCPeerConnection`, receives the mobile's video track, adds it as a `Mobile Camera` source
- **Virtual camera**: composites all visible sources onto a canvas at up to 1080p60, can be captured as a stream for recording or projection
- **Supabase realtime**: scene changes sync across browser tabs via Postgres CDC

### Mobile app (`apps/mobile`)

Expo SDK 54 + React Native 0.81 with New Architecture enabled. Key concepts:

- **Engine pattern**: business logic lives in hooks (`use-camera-engine`, `use-streaming-engine`, `use-recording-engine`, `use-control-engine`, `use-session-engine`) — screens just call these hooks
- **Zustand stores**: four stores (`camera-store`, `streaming-store`, `recording-store`, `session-store`) hold all state
- **Vision Camera**: native camera capture — required for high-quality video and remote control commands
- **WebRTC producer**: `webrtc-service.ts` creates the `RTCPeerConnection`, adds camera tracks, creates the offer, and handles the answer

---

## Remote Camera Control

The studio can control the mobile camera in real time via `COMMAND` events:

| Command | Effect |
|---|---|
| `SET_ZOOM` | Sets zoom level (value: 0.0–1.0) |
| `TOGGLE_TORCH` | Toggles flashlight on/off |
| `SWITCH_CAMERA` | Flips between front and back camera |
| `SET_EXPOSURE` | Sets exposure compensation (future) |
| `START_RECORDING` | Triggers native Vision Camera recording |
| `STOP_RECORDING` | Stops native recording, saves to gallery |

Commands are emitted from the studio via `socketRef.current.emit(SOCKET_EVENTS.COMMAND, { roomId, command })`, relayed by the server, and handled in `use-control-engine.ts` on the mobile.

---

## Troubleshooting

**Mobile can't connect to the signaling server**
- Check `apps/mobile/app.json → extra.signalingServerUrl` matches your machine's IP
- Make sure the API server is running (`npm run dev:api`)
- Both devices must be on the same Wi-Fi network
- Check your firewall isn't blocking port 3001

**Pairing overlay never dismisses**
- The `PAIRED` event fires when both clients are in the same room — verify the room code matches exactly (case-sensitive, e.g. `PS-8A3F`)
- Check the API server console for `PAIRED emitted for room PS-XXXX`

**Video doesn't appear in studio after pairing**
- Open browser DevTools → Console — look for `Received track from mobile: video`
- If the track is received but no source appears, check that `activeSceneId` is set (you need at least one scene)

**WebRTC fails on a corporate or restricted network**
- The TURN servers (Open Relay Project) should handle most NAT scenarios
- For production, replace with a dedicated TURN server (metered.ca, Twilio, or self-hosted coturn)

**Recording chunks not appearing in Supabase Storage**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `apps/api/.env`
- Check the API server console for upload errors
- Make sure the `recordings` bucket exists — see `docs/supabase-setup.md`
