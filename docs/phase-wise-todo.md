# Mobile ↔ Studio Integration — Phase-wise Todo Plan

> **Scope:** End-to-end implementation plan covering room creation in the Studio, mobile pairing, live streaming, remote-triggered recording, and video save/storage.
>
> **Based on:** Full codebase audit of `apps/api`, `apps/web`, `apps/mobile`, and `packages/shared` (May 2026).

---

## Current State Summary

| Area | Status | Notes |
|---|---|---|
| Socket.io signaling server | ✅ Fixed | Handles both payload shapes, emits PAIRED, no echo |
| Shared event contract | ✅ Working | `packages/shared/src/index.ts` — SOCKET_EVENTS, types |
| Studio room ID | ✅ Fixed | `roomCode` (`PS-XXXX`) generated, shown in QR panel with copy button |
| Mobile pairing UI | ✅ Fixed | URL config-driven, reconnection enabled |
| WebRTC offer/answer | ✅ Fixed | Both sides use `SIGNAL` wrapper — handshake aligned |
| WebRTC stream display | ✅ Fixed | `ontrack` wires stream to `mobile-camera` source in active scene |
| Mobile connected badge | ✅ Fixed | Menu bar shows room code / "Mobile: Live" with pulse indicator |
| Mobile recording | ✅ Working | Vision Camera → saves to device gallery via `expo-media-library` |
| Studio recording | ✅ Working | `MediaRecorder` → WebM chunks → `/api/upload-chunk` → Supabase |
| Remote START_RECORDING command | ❌ Missing | `use-control-engine.ts` has a `// TODO` comment — Phase 4 |
| Video persistence | ⚠️ Partial | Chunks uploaded to API but `/api/upload-chunk` only logs — Phase 5 |

---

## Phase 1 — Fix the Signaling Contract ✅

> **Goal:** Make mobile and studio speak the same Socket.io language.

### 1.1 — Align WebRTC Signal Events ✅

- [x] **`packages/shared/src/index.ts`** — `SIGNAL` already present. No change needed.
- [x] **`apps/mobile/src/services/webrtc-service.ts`** — Replaced direct `OFFER` / `ICE_CANDIDATE` emits with the `SIGNAL` wrapper.
- [x] **`apps/mobile/src/engines/streaming/use-streaming-engine.ts`** — Replaced `ANSWER` + `ICE_CANDIDATE` listeners with a single `SIGNAL` listener.

### 1.2 — Fix the PAIRED Handshake ✅

- [x] **`apps/api/server.ts`** — `JOIN_ROOM` handles both string and `{ roomId, role }` shapes. Emits `PAIRED` when ≥2 clients in a room. SIGNAL/COMMAND relays use `socket.to()` (no echo).
- [x] **`apps/web/src/App.tsx`** — `PAIRED` listener added (Phase 2).

### 1.3 — Fix Mobile Server URL Configuration ✅

- [x] **`apps/mobile/src/constants/config.ts`** — Created. Reads `signalingServerUrl` from `expo-constants`, falls back to `http://192.168.1.2:3001`.
- [x] **`apps/mobile/app.json`** — `signalingServerUrl: "http://192.168.1.2:3001"` added to `extra`.
- [x] **`apps/mobile/src/services/socket-service.ts`** — Uses config URL. Reconnection options added.

---

## Phase 2 — Room Creation & Pairing UX ✅

> **Goal:** Studio generates a human-readable Room ID and displays it. Mobile enters it to connect.

### 2.1 — Human-Readable Room ID in Studio ✅

- [x] **`apps/web/src/App.tsx`** — Added `roomCode` state (`PS-XXXX` from first 4 chars of `studioId`). Set alongside every `setStudioId` call. Cleared on logout.
- [x] **`apps/web/src/App.tsx`** — Added `mobileConnected` boolean state. Reset on logout and socket cleanup.
- [x] **`apps/web/src/App.tsx`** — `JOIN_ROOM` emit updated to `{ roomId: studioId, role: 'studio' }`.
- [x] **`apps/web/src/App.tsx`** — `PAIRED` listener sets `mobileConnected = true`.
- [x] **`apps/web/src/App.tsx`** — `QR code` now encodes `roomCode`. Panel shows large room code text, copy button, and live connection status badge.

### 2.2 — Mobile Pairing Flow ✅

- [x] **`apps/mobile/src/components/pairing-overlay.tsx`** — Already correct. No changes needed.
- [x] **`apps/mobile/src/engines/streaming/use-streaming-engine.ts`** — `joinRoom` sends `{ roomId, role: 'producer' }` (fixed in Phase 1).
- [ ] **QR scanner** — Optional future enhancement. Manual code entry is sufficient.

---

## Phase 3 — WebRTC Stream Display in Studio ✅

> **Goal:** The mobile video stream appears as a source in the studio canvas.

### 3.1 — Wire Incoming WebRTC Track to a Studio Source ✅

- [x] **`apps/web/src/App.tsx`** — `setupPeerConnection` now creates a `remoteStream = new MediaStream()`. `ontrack` adds each incoming track to it, updates `streams['mobile-camera']`, and auto-inserts a `Mobile Camera` source at the top of the active scene's source list (ephemeral — not persisted to Supabase).
- [x] **`apps/web/src/App.tsx`** — On socket cleanup, `mobile-camera` source is removed from all scenes and from the `streams` map.
- [x] **`apps/web/src/App.tsx`** — `SourceVideo` already handles `type: 'camera'` with a `stream` prop via `videoRef.current.srcObject = stream`. No change needed.

### 3.2 — Connection State Indicator in Studio ✅

- [x] **`apps/web/src/App.tsx`** — Menu bar badge added: shows `roomCode` when waiting, `Mobile: Live` (green pulse) when connected. Only visible when `studioId` is set (i.e. user is logged in).

---

## Phase 4 — Recording Flow ✅

> **Goal:** Studio can trigger mobile recording remotely. Both sides record reliably.

### 4.1 — Studio-Side Recording (Web) ✅ (partial)

- [x] **`apps/web/src/App.tsx`** — Chunk interval reduced from `600000` (10 min) to `30000` (30 sec) for crash resilience.
- [ ] **`apps/api/server.ts`** — Actual chunk storage (Supabase Storage) — Phase 5.
- [ ] **`apps/api/server.ts`** — `/api/recordings/:recordingId/finalize` endpoint — Phase 5.
- [ ] **`apps/web/src/App.tsx`** — Call finalize on `recorder.onstop` — Phase 5.

### 4.2 — Mobile-Side Remote Recording ✅

- [x] **`apps/mobile/src/state/recording-store.ts`** — Added `remoteStartRequested` and `remoteStopRequested` boolean flags with setters. `reset()` clears them too.
- [x] **`apps/mobile/src/engines/control/use-control-engine.ts`** — `START_RECORDING` sets `remoteStartRequested = true`; `STOP_RECORDING` sets `remoteStopRequested = true`. Supports both `command` and legacy `type` field on the payload.
- [x] **`apps/mobile/src/engines/recording/use-recording-engine.ts`** — Two `useEffect` hooks watch the flags. Each resets the flag immediately (one-shot), checks the current recording status, and calls `startRecording()` / `stopRecording()` accordingly.

### 4.3 — Studio Triggers Mobile Recording ✅

- [x] **`apps/web/src/App.tsx`** — Added `isMobileRecording` state (reset on mobile disconnect).
- [x] **`apps/web/src/App.tsx`** — Added `triggerMobileRecording(action)` — emits `COMMAND` with `{ roomId: studioId, command: action }`.
- [x] **`apps/web/src/App.tsx`** — "Record Mobile" / "Stop Mobile Rec" button added to both the Controls Dock and the compact Control Center grid. Button is visually disabled (`opacity-40 cursor-not-allowed`) when no mobile is connected.

---

## Phase 5 — Video Save & Storage Architecture ✅

> **Goal:** Recorded video is actually persisted, not just logged.

### 5.1 — Mobile Video Storage ✅

Saved to device gallery (`PodSoft` album) via `expo-media-library`. No changes needed.

### 5.2 — Studio Video Storage ✅

- [x] **`docs/supabase-setup.md`** — Created. Step-by-step guide: create `recordings` bucket, RLS policies, `finalUrl` column migration, service role key setup.
- [x] **`apps/api/.env`** — Added `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` placeholders with instructions.
- [x] **`apps/api/server.ts`** — Initialised `supabaseAdmin` client (service role, no session persistence). Graceful fallback when keys are not configured — server still starts and old stub behaviour is preserved for local dev without Supabase.
- [x] **`apps/api/server.ts`** — `/api/upload-chunk` now uploads each chunk to `recordings/{recordingId}/{index}.webm` in Supabase Storage.
- [x] **`apps/api/server.ts`** — `/api/recordings/:recordingId/finalize` endpoint: lists chunks, downloads them in order, concatenates into a single Buffer, uploads as `final.webm`, generates a 7-day signed URL, updates `recordings.finalUrl` in the DB.
- [x] **`apps/web/src/App.tsx`** — `recorder.onstop` now calls `/api/recordings/:recordingId/finalize`, downloads via signed URL. Falls back to local blob download if Supabase is not configured or finalize fails.
- [x] **`apps/web/src/App.tsx`** — `FilePage` recordings list now shows a **Download** button when `rec.finalUrl` is set (links directly to the signed URL). Shows a disabled placeholder while recording is in progress or not yet finalized.

---

## Phase 6 — Hardening & Production Readiness ✅

### 6.1 — WebRTC Reliability ✅

- [x] **`apps/mobile/src/services/webrtc-service.ts`** — Added two STUN servers (Google) + two TURN fallbacks (Open Relay Project — free, suitable for dev/testing). Comment notes to replace with metered.ca/Twilio/coturn for production.
- [x] **`apps/web/src/App.tsx`** — Same STUN + TURN config added to `setupPeerConnection`.
- [x] **`apps/mobile/src/engines/streaming/use-streaming-engine.ts`** — Added `disconnect` handler: sets status to `reconnecting`, clears `isPaired`. Added `reconnect` handler: re-joins the room so `PAIRED` fires again. Added `reconnect_failed` handler: sets error and `failed` status.
- [x] **`apps/mobile/src/services/socket-service.ts`** — Reconnection already enabled in Phase 1 (`reconnectionAttempts: 5`, `reconnectionDelay: 2000`).

### 6.2 — Mobile Build Configuration ✅ (partial)

- [x] `signalingServerUrl` in `app.json → extra` set to `192.168.1.2:3001`.
- [ ] Separate URLs per EAS build profile (dev/preview/prod) — manual step when deploying.

### 6.3 — Error Handling ✅

- [x] **`apps/web/src/App.tsx`** — Added `mobileDisconnectToast` state. When the studio socket disconnects while `mobileConnected` is true, a toast appears for 5 seconds ("Mobile device disconnected") with a dismiss button. Cleared when mobile re-pairs.
- [x] **`apps/mobile/src/engines/streaming/use-streaming-engine.ts`** — `reconnect_failed` sets a user-facing error message. `PairingOverlay` already renders `error` from the streaming store.

### 6.4 — Security (deferred — not blocking)

- [ ] Room ID format validation on server (`PS-XXXX` pattern).
- [ ] Rate limiting on `/api/upload-chunk`.
- [ ] Supabase RLS policies for studios, scenes, recordings (covered in `docs/supabase-setup.md` for Storage; table-level RLS is a separate manual step).
