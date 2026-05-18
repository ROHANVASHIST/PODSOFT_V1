# Problems Encountered & Fixes Applied

A chronological record of every bug found and how it was resolved.

---

## 1. Mobile never connected to the signaling server

**Symptom:** Pairing overlay showed "connecting" indefinitely. No socket connection in logs.

**Root cause — stale hardcoded IP in `app.json`:**
```json
"signalingServerUrl": "http://192.168.1.204:3001"
```
This was the fallback for standalone builds. On any machine that isn't `192.168.1.204`, the mobile silently connected to the wrong server.

**Root cause — studio connected to wrong port on LAN access:**
The studio's `signalingUrl` logic only used port `3001` when `hostname === 'localhost'`. Opening the studio from another device on the LAN (e.g. `http://192.168.1.x:3000`) made it try `window.location.origin` = port `3000` — the wrong port.

**Fixes:**
- Removed `signalingServerUrl` from `app.json`. Dev client builds auto-detect via `hostUri`; standalone builds must set `SIGNALING_SERVER_URL` in `eas.json`.
- Studio `signalingUrl` now detects dev mode by checking if the port is `3000` or `5173` (Vite), and always points to `:3001` in that case.

---

## 2. Stream connected but video never appeared in the studio

**Symptom:** `PAIRED` fired, WebRTC negotiated, but the studio program monitor showed nothing.

**Root cause A — `mobile-camera` source wiped by Supabase sync:**
The scene items sync effect runs whenever `streams` state changes. It fetched DB rows and replaced all scene sources, discarding the ephemeral `mobile-camera` source (which is never in the DB). The sequence:
```
ontrack fires → setStreams({ 'mobile-camera': remoteStream })  ← triggers effect
effect runs → fetchItems() from Supabase → setScenes replaces ALL sources
mobile-camera is gone ✗
```

**Root cause B — Program view used `source.stream` not `streams[source.id]`:**
The preview panel correctly used `streams[source.id] || source.stream`. The program monitor only used `source.stream`, which was stale after the sync wipe.

**Fixes:**
- Scene items sync now preserves ephemeral sources (those not in the DB) before overwriting.
- Program monitor updated to use `streams[source.id] || source.stream`.

---

## 3. Stream was laggy and froze after a few seconds

**Symptom:** Video appeared briefly then froze. Repeated black frames every few seconds.

**Root cause A — ICE candidate race condition:**
ICE candidates arrived via the signaling server before `setRemoteDescription` was called. `addIceCandidate` threw or silently failed, meaning the direct LAN path was never established and the connection fell back to the TURN relay (or failed entirely).

**Root cause B — `srcObject` re-assigned on every `ontrack` event:**
`ontrack` fires twice (once for video, once for audio). Each call triggered `setStreams(...)` with a new object reference → React re-render → `useEffect([stream])` re-ran → `videoRef.current.srcObject` was re-assigned. Re-assigning `srcObject` on a playing `<video>` forces the browser to restart its media pipeline — that's the freeze.

**Root cause C — No bitrate cap:**
The mobile encoder ran unconstrained, spiked bandwidth, and the browser decoder dropped frames.

**Root cause D — No `stop()` before `start()` on reconnect:**
`webrtcService.start()` created a new `RTCPeerConnection` without closing the old one, leaking the previous connection.

**Fixes:**
- Both mobile and studio now buffer ICE candidates until `setRemoteDescription` completes, then drain the buffer.
- `setStreams` bails early if the `MediaStream` reference is already the same object.
- `SourceVideo` only assigns `srcObject` if `videoRef.current.srcObject !== stream`.
- Video sender capped at 2.5 Mbps via `RTCRtpSender.setParameters()` after answer is applied.
- `webrtcService.start()` calls `this.stop()` at the top to clean up any previous session.

---

## 4. `camera/camera-already-in-use` error on stream start

**Symptom:** After tapping "GO LIVE", the app threw `CameraRuntimeError: The given Camera Device is already in use!`

**Root cause:**
`react-native-vision-camera` and `react-native-webrtc` both use Android's Camera2 API. Android does not allow two Camera2 sessions on the same physical device simultaneously — even within the same app process. Vision Camera held the Camera2 session open for the preview while `getUserMedia` tried to open a second session.

**Fix (Option B — `isActive` toggle + release delay):**
- `<Camera isActive={!isPaired} />` — when `isPaired` becomes `true`, Vision Camera releases its Camera2 session.
- `webrtcService.start()` waits 400ms after `stop()` before calling `getUserMedia`, giving the Camera2 framework time to fully close the previous session.
- When streaming stops, `isPaired` becomes `false` → `isActive={true}` → Vision Camera preview resumes.

**Two-mode viewfinder (Option C — RTCView during streaming):**
To avoid a black screen during streaming, the screen now renders `<RTCView>` showing the local WebRTC stream while `isPaired=true`, and `<Camera>` when not paired. The user always sees a live viewfinder.

---

## 5. `capture/no-data` error when tapping record while streaming

**Symptom:** Tapping the record button while streaming produced `capture/no-data` — Vision Camera started the recorder, got zero frames, and immediately errored.

**Root cause:**
`startRecording()` was called on a Vision Camera instance with `isActive={false}` (because `isPaired=true` yields the camera to WebRTC). Vision Camera had no active camera session to record from.

**Fix:**
Record button is disabled (`disabled={isPaired}`) and visually dimmed while streaming. Recording and streaming are mutually exclusive with the current architecture — both require exclusive Camera2 access.

> **Future work:** Simultaneous record + stream requires either a native bridge (Vision Camera frame processor → custom WebRTC track) or server-side recording of the incoming WebRTC stream. See `architecture.md` for details.

---

## 6. ICE candidate fields showed `undefined` in logs

**Symptom:** Logs showed `type="undefined" protocol="undefined" address="undefined"` for ICE candidates.

**Root cause:** `react-native-webrtc` does not expose `type`, `protocol`, or `address` as direct properties on the candidate event object. They are embedded inside the `candidate.candidate` SDP string.

**Status:** Non-issue — the connection still establishes correctly as confirmed by `iceConnectionState → connected`. Log format updated to note this limitation.
