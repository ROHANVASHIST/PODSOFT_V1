# PodSoft — Data Flow & API Documentation

**Version:** 2.0  
**Status:** Production Ready  
**Last Updated:** May 2026  
**Audience:** Engineers, Frontend Developers, Mobile Developers  
**Document Owner:** Engineering Lead

---

## 1. Complete Data Flow Diagrams

### 1.1 Session Creation & Setup Flow

```
┌──────────────────────────────────────────────────────────┐
│                    User (Web Studio)                      │
│                                                            │
│  1. Click "New Session"                                  │
│     • Name: "Podcast Ep 42"                              │
│     • Template: "Podcast"                                │
│     • Settings: {chunkSize: 600s, ...}                   │
│                                                            │
│  2. Form submitted to API                                │
└──────────────────┬───────────────────────────────────────┘
                   │ POST /api/sessions
                   │ {name, template_id, settings}
                   ▼
┌──────────────────────────────────────────────────────────┐
│                    API Server                             │
│                                                            │
│  1. Validate input                                       │
│     • Check user authentication (JWT)                    │
│     • Verify plan limits (5 free sessions)               │
│     • Validate template exists                           │
│                                                            │
│  2. Create session record                                │
│     INSERT INTO sessions (user_id, name, status, ...)    │
│     WHERE status = 'prep'                                │
│                                                            │
│  3. Generate session token                               │
│     • sessionId = "sess_abc123def"                        │
│     • joinToken = "jwt_..." (for devices)                │
│     • UUID for tracking                                  │
│                                                            │
│  4. Cache in Redis                                       │
│     SET session:sess_abc123def {json} EX 86400           │
│                                                            │
│  5. Return response                                      │
└──────────────────┬───────────────────────────────────────┘
                   │ 200 OK
                   │ {
                   │   id: "sess_abc123def",
                   │   status: "prep",
                   │   join_token: "jwt_...",
                   │   created_at: "2026-05-03T12:00:00Z"
                   │ }
                   ▼
┌──────────────────────────────────────────────────────────┐
│                    Web Studio (Frontend)                  │
│                                                            │
│  1. Display QR code with joinToken                       │
│  2. Show "Waiting for devices..." message                │
│  3. Establish WebSocket connection                       │
│     io.on('session:update', (session) => {...})          │
│                                                            │
│  Ready for devices to join!                              │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Device Connection Flow

```
┌──────────────────────────────────────────────────────────┐
│                 Device (Mobile App)                       │
│                                                            │
│  User scans QR code or enters join token:                │
│  "sess_abc123def"                                         │
│                                                            │
│  1. Open WebSocket to /ws with token                     │
│     ws = new WebSocket(                                  │
│       'wss://api.podsoft.io/ws',                         │
│       ['Bearer', joinToken]                              │
│     )                                                     │
└──────────────────┬───────────────────────────────────────┘
                   │ WebSocket Handshake
                   │ Authorization: Bearer jwt_...
                   ▼
┌──────────────────────────────────────────────────────────┐
│                    API Server (Socket.IO)                │
│                                                            │
│  1. Validate JWT token                                   │
│     • Verify signature                                   │
│     • Check expiry                                       │
│     • Extract sessionId from payload                     │
│                                                            │
│  2. Create device record                                 │
│     INSERT INTO devices (                                │
│       session_id,                                        │
│       label: "iPhone Pro",                               │
│       kind: "phone",                                     │
│       device_token: uuid(),                              │
│       os: "iOS",                                         │
│       ...                                                │
│     )                                                     │
│                                                            │
│  3. Associate socket with device                         │
│     socket.data.deviceId = "device_xyz"                  │
│     socket.data.sessionId = "sess_abc"                   │
│                                                            │
│  4. Cache device status in Redis                         │
│     SET device:device_xyz:status {json} EX 3600          │
│                                                            │
│  5. Broadcast to session room                            │
│     io.to(`session_sess_abc`).emit(                      │
│       'device:connected',                                │
│       { deviceId, label, kind, ... }                     │
│     )                                                     │
└──────────────────┬───────────────────────────────────────┘
                   │ Socket: 'device:connected'
                   │ { deviceId: 'device_xyz', ... }
                   ▼
┌──────────────────────────────────────────────────────────┐
│                 Web Studio (Frontend)                     │
│                                                            │
│  1. Receive event via Socket.IO                          │
│     socket.on('device:connected', (device) => {          │
│       setState(prev => ({                                │
│         ...prev,                                         │
│         devices: [...prev.devices, device]               │
│       }))                                                │
│     })                                                    │
│                                                            │
│  2. Update UI                                            │
│     • Add device tile showing iPhone Pro                 │
│     • Show signal strength, battery                      │
│     • Ready to record                                    │
└──────────────────────────────────────────────────────────┘
```

### 1.3 Recording & Chunk Upload Flow

```
┌──────────────────────────────────────────────────────────┐
│                    Web Studio                             │
│                                                            │
│  User clicks "Record" button                             │
│  1. POST /api/sessions/sess_abc/start                    │
│  2. Server broadcasts: 'command:record_start'            │
└──────────────────┬───────────────────────────────────────┘
                   │
      ┌────────────┴────────────┬────────────────┐
      │                         │                │
      ▼                         ▼                ▼
  Device 1               Device 2            Device 3
  (iPhone)              (Laptop)            (Mic Only)
  
┌──────────────────────────────────────────────────────────┐
│                   DEVICE (Phone/Laptop)                   │
│                                                            │
│  Receive: 'command:record_start'                         │
│  1. Start H.264 video encoding                           │
│  2. Start AAC audio encoding                             │
│  3. Begin local recording to:                            │
│     /device_storage/sess_abc/stream.mp4                  │
│                                                            │
│  4. Emit preview stream (low-res, low-bitrate)           │
│     to ws://api.podsoft.io/preview                       │
│     • Resolution: 720p                                   │
│     • Bitrate: 2 Mbps                                    │
│     • Updated every frame                                │
│                                                            │
│  Every 10 minutes (chunk_duration):                      │
│  ┌────────────────────────────────────────┐              │
│  │ 1. Finalize current chunk               │              │
│  │    • Stop encoding chunk_0.mp4         │              │
│  │    • Save metadata: chunk_0.meta.json  │              │
│  │    • Compute hash: sha256(chunk_0)     │              │
│  │                                         │              │
│  │ 2. Begin next chunk                     │              │
│  │    • Start chunk_1.mp4 encoding        │              │
│  │    • Continue recording in parallel     │              │
│  │                                         │              │
│  │ 3. Request upload credentials           │              │
│  │    POST /api/sessions/sess_abc/chunks  │              │
│  │    {                                    │              │
│  │      deviceId: "device_xyz",           │              │
│  │      chunkIndex: 0,                    │              │
│  │      duration: 600000,                 │              │
│  │      fileSize: 750000000,              │              │
│  │      hash: "sha256hash...",            │              │
│  │      filename: "chunk_0.mp4"           │              │
│  │    }                                    │              │
│  └────────────┬─────────────────────────┘              │
│               │                                         │
│               ▼                                         │
│  ┌────────────────────────────────────────┐            │
│  │ 4. Receive presigned S3 URL             │            │
│  │    {                                    │            │
│  │      url: "https://podsoft...?...",    │            │
│  │      fields: {...}                     │            │
│  │    }                                    │            │
│  │                                         │            │
│  │ 5. Upload chunk to S3 (multipart)       │            │
│  │    • Part 1: bytes 0-100MB              │            │
│  │    • Part 2: bytes 100MB-200MB          │            │
│  │    • ...                                │            │
│  │    • Part N: final bytes                │            │
│  │    • Emit 'chunk:upload_progress'      │            │
│  │      every 5% completion                │            │
│  │                                         │            │
│  │ 6. On success: 'chunk:uploaded'        │            │
│  │    S3 event → SNS → server updates DB   │            │
│  │                                         │            │
│  │ 7. On failure: Retry with backoff      │            │
│  │    • Retry 1: 2 seconds                 │            │
│  │    • Retry 2: 4 seconds                 │            │
│  │    • Retry 3: 8 seconds                 │            │
│  │    If all fail: queue for batch upload  │            │
│  └────────────────────────────────────────┘            │
│                                                         │
│  Continue recording... (no interruption!)              │
│  Channels:                                             │
│  • Recording: H.264 encoding to local file             │
│  • Upload: S3 multipart upload in background           │
│  • Preview: WebRTC/MJPEG stream to server              │
└──────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
   Upload Progress              Server Receives
   Notify UI: 45%               Chunk Complete
                                Update DB:
                                chunks.upload_status = 'completed'
                                chunks.uploaded_at = NOW()
                                
                                Broadcast via WebSocket:
                                io.to('session_...').emit(
                                  'chunk:uploaded',
                                  { deviceId, chunkIndex }
                                )
```

### 1.4 Processing Pipeline Flow

```
┌──────────────────────────────────────────────────────────┐
│                    Web Studio                             │
│                                                            │
│  User clicks "Stop Recording"                            │
│  Session status: recording → stopped                     │
│                                                            │
│  Automatically or manually:                              │
│  "Generate Video" button clicked                         │
└──────────────────┬───────────────────────────────────────┘
                   │ POST /api/sessions/sess_abc/process
                   │ {
                   │   template_id: "tmpl_podcast",
                   │   jobs: ["sync", "denoise", "transcribe", "render"],
                   │   output_formats: ["mp4_1080p", "mp4_720p", "srt"]
                   │ }
                   ▼
┌──────────────────────────────────────────────────────────┐
│                    API Server                             │
│                                                            │
│  1. Validate all chunks uploaded                         │
│     SELECT * FROM chunks WHERE session_id = ?            │
│     AND upload_status != 'completed'                     │
│                                                            │
│  2. Create processing jobs in Bull queue                 │
│     └─ Job 1: sync                                       │
│        ├─ Detect offset between device_a, device_b      │
│        └─ Store in DB: sync_markers table                │
│                                                            │
│     └─ Job 2: denoise (parallel)                         │
│        ├─ Load audio from chunks                         │
│        └─ Apply spectral subtraction                     │
│                                                            │
│     └─ Job 3: transcribe (parallel)                      │
│        ├─ Call Whisper API                               │
│        └─ Store SRT in S3                                │
│                                                            │
│     └─ Job 4: render_template (depends on 1-3)          │
│        ├─ Build FFmpeg filter graph                      │
│        ├─ Apply sync offsets                             │
│        ├─ Mix audio, composite video                     │
│        └─ Output: mp4_1080p, mp4_720p, srt              │
│                                                            │
│  3. Enqueue jobs (Bull queue in Redis)                   │
│     ├─ Job: {id: 'job_1', type: 'sync', ...}            │
│     ├─ Job: {id: 'job_2', type: 'denoise', ...}         │
│     ├─ Job: {id: 'job_3', type: 'transcribe', ...}      │
│     └─ Job: {id: 'job_4', type: 'render', ...}          │
│                                                            │
│  4. Return response                                      │
│     { jobIds: [job_1, job_2, job_3, job_4] }           │
│                                                            │
│  5. Broadcast via WebSocket                             │
│     io.to('session_...').emit('processing:started', {}) │
└──────────────────┬───────────────────────────────────────┘
                   │
      ┌────────────┴────────────┬─────────────────┐
      │                         │                 │
      ▼                         ▼                 ▼
   Worker 1              Worker 2           Worker 3
   (Sync)               (Denoise)        (Transcribe)
   
┌──────────────────────────────────────────────────────────┐
│                   WORKER 1: SYNC DETECTION               │
│                                                            │
│  1. Fetch job from Bull queue                            │
│     Job ID: job_1, Type: 'sync'                          │
│                                                            │
│  2. Download chunks from S3                              │
│     ├─ device_a/chunk_0.mp4                              │
│     ├─ device_b/chunk_0.mp4                              │
│     └─ ... all chunks                                    │
│                                                            │
│  3. Extract audio waveforms                              │
│     ├─ ffmpeg -i chunk_0.mp4 -q:a 9 -acodec libmp3lame  │
│     ├─ Downsample to 8kHz for faster correlation         │
│     └─ Load into memory as float32 arrays                │
│                                                            │
│  4. Cross-correlation analysis                           │
│     For each pair (device_a, device_b):                  │
│     ├─ Find delay by maximizing correlation              │
│     ├─ offset_ms = argmax(xcorr(audio_a, audio_b)) * ms │
│     └─ Confidence score (0-100%)                         │
│                                                            │
│  5. Apply heuristics                                     │
│     ├─ If |offset| > 1000ms: manual sync required        │
│     ├─ If confidence < 70%: flag for review              │
│     └─ Otherwise: auto-detected offset                   │
│                                                            │
│  6. Store results in DB                                  │
│     INSERT INTO sync_markers (                           │
│       session_id, device_a, device_b,                    │
│       offset_ms, confidence, marker_type: 'audio'        │
│     )                                                     │
│                                                            │
│  7. Update job status                                    │
│     job_1.status = 'completed'                           │
│     job_1.result = { sync_markers: [...] }               │
│                                                            │
│  8. Broadcast progress                                   │
│     socket.emit('job:completed', { jobId: job_1 })      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              WORKER 2: DENOISE (Parallel)               │
│                                                            │
│  1. Load job from queue: job_2 (denoise)                │
│  2. Download all audio from chunks                       │
│  3. Estimate noise profile (quiet sections)              │
│  4. Apply spectral subtraction filter                    │
│  5. Normalize loudness to -16 LUFS                       │
│  6. Return denoised audio tracks                         │
│  7. Cache in Redis for render step                       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           WORKER 3: TRANSCRIPTION (Parallel)            │
│                                                            │
│  1. Load job from queue: job_3 (transcribe)             │
│  2. Extract audio from chunks                            │
│  3. Call OpenAI Whisper API                              │
│     POST https://api.openai.com/v1/audio/transcriptions  │
│     ├─ File: audio.wav                                   │
│     ├─ Model: whisper-1                                  │
│     ├─ Language: en                                      │
│     └─ Response format: verbose_json                     │
│  4. Parse response: {segments, language}                 │
│  5. Generate SRT file                                    │
│  6. Upload to S3: sessions/sess_abc/transcription.srt   │
│  7. Update DB: transcriptions table                      │
│  8. Return SRT URL to frontend                           │
└──────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
      Done          Done           Done
        │              │              │
        └──────────────┼──────────────┘
                       │
                  All pre-jobs complete
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│             WORKER 4: RENDER TEMPLATE                    │
│                                                            │
│  1. Fetch job: job_4 (render_template)                  │
│  2. Load session metadata                                │
│  3. Fetch sync offsets from DB                           │
│  4. Load template: "podcast"                             │
│     {                                                    │
│       canvas: {w: 1920, h: 1080},                        │
│       tracks: [                                          │
│         {device: device_a, x: 0, w: 960},                │
│         {device: device_b, x: 960, w: 960}               │
│       ],                                                 │
│       audio: {mix: "sum"}                                │
│     }                                                    │
│                                                            │
│  5. Build FFmpeg filter graph                            │
│     -i chunk_a_0.mp4 -i chunk_b_0.mp4 ... \             │
│     -filter_complex "[0:v]scale=960:1080[v0];            │
│                      [1:v]scale=960:1080[v1];            │
│                      [v0][v1]hstack=inputs=2[v];        │
│                      [0:a]adelay=50|50[a0];              │
│                      [1:a]adelay=30|30[a1];              │
│                      [a0][a1]amix=inputs=2:duration=first│
│                      [a]" \                              │
│     -map "[v]" -map "[a]" -c:v h264 -c:a aac output.mp4│
│                                                            │
│  6. Execute FFmpeg (1.5x real-time)                      │
│     ffmpeg ... (wait for process)                        │
│     Time: 1h video = ~40 min render                      │
│                                                            │
│  7. Progress tracking                                    │
│     job_4.progress(25) → broadcast to UI                │
│     job_4.progress(50) → broadcast to UI                │
│     ...                                                  │
│                                                            │
│  8. Output generation                                    │
│     ├─ final_1080p.mp4 (primary)                         │
│     ├─ final_720p.mp4 (web)                              │
│     ├─ final_480p.mp4 (mobile)                           │
│     └─ reel_vertical.mp4 (TikTok/Reels)                  │
│                                                            │
│  9. Upload to S3                                         │
│     Sessions/sess_abc/output/final_1080p.mp4             │
│                                                            │
│  10. Update database                                     │
│      INSERT INTO outputs (                               │
│        session_id, output_type, format,                  │
│        file_size, s3_path, status: 'completed'           │
│      )                                                    │
│                                                            │
│  11. Job complete                                        │
│      job_4.status = 'completed'                          │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│                    Web Studio (Frontend)                 │
│                                                            │
│  WebSocket events:                                       │
│  ✓ 'job:completed' {jobId: job_4, output: {...}}       │
│                                                            │
│  UI Updates:                                             │
│  1. Hide "Processing..." spinner                         │
│  2. Show "Video Ready!" message                          │
│  3. Display video preview thumbnail                      │
│  4. Show download/share options                          │
│  5. Offer template options for variations                │
│                                                            │
│  Final outputs available:                                │
│  • final_1080p.mp4 → Download or stream                  │
│  • final_720p.mp4 → Share on web                         │
│  • reel_vertical.mp4 → TikTok/Reels                      │
│  • transcription.srt → Captions                          │
└──────────────────────────────────────────────────────────┘
```

---

## 2. REST API Reference

### 2.1 Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201 Created)**
```json
{
  "status": "success",
  "data": {
    "id": "user_abc123",
    "email": "user@example.com",
    "first_name": "John",
    "plan": "free",
    "created_at": "2026-05-03T12:00:00Z"
  },
  "meta": {
    "timestamp": "2026-05-03T12:00:00Z"
  }
}
```

**Errors**
- `400`: Invalid email format or weak password
- `409`: Email already registered

---

#### POST /api/auth/login
Authenticate and receive JWT token.

**Request**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "rt_xyz...",
    "expires_in": 86400,
    "user": {
      "id": "user_abc123",
      "email": "user@example.com",
      "plan": "free"
    }
  }
}
```

---

#### POST /api/auth/refresh
Refresh expiring access token.

**Request**
```json
{
  "refresh_token": "rt_xyz..."
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

---

### 2.2 Session Endpoints

#### POST /api/sessions
Create a new recording session.

**Request**
```json
{
  "name": "Podcast Episode 42",
  "description": "Interview with special guest",
  "template_id": "tmpl_podcast",
  "settings": {
    "chunk_size_ms": 600000,
    "preview_bitrate": 2000000,
    "recording_quality": "1080p",
    "auto_process": true
  }
}
```

**Response (201 Created)**
```json
{
  "status": "success",
  "data": {
    "id": "sess_abc123def456",
    "user_id": "user_xyz",
    "name": "Podcast Episode 42",
    "status": "prep",
    "join_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "settings": {
      "chunk_size_ms": 600000,
      "preview_bitrate": 2000000
    },
    "qr_code_url": "https://api.podsoft.io/qr?token=...",
    "created_at": "2026-05-03T12:00:00Z"
  }
}
```

---

#### GET /api/sessions
List user's sessions with pagination.

**Query Parameters**
- `status`: Filter by status (prep, recording, stopped, processing, ready, archived)
- `limit`: Items per page (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)
- `sort`: Sort field + direction (e.g., `created_at:desc`)

**Request**
```
GET /api/sessions?status=stopped&limit=10&sort=created_at:desc
Authorization: Bearer <access_token>
```

**Response (200 OK)**
```json
{
  "status": "success",
  "data": [
    {
      "id": "sess_abc123def456",
      "name": "Podcast Episode 42",
      "status": "ready",
      "device_count": 2,
      "chunk_count": 6,
      "created_at": "2026-05-03T12:00:00Z",
      "stopped_at": "2026-05-03T13:15:00Z",
      "stats": {
        "duration_ms": 4500000,
        "total_size_gb": 45.2,
        "sync_accuracy_percent": 99.7
      }
    }
  ],
  "meta": {
    "total": 42,
    "limit": 10,
    "offset": 0
  }
}
```

---

#### GET /api/sessions/:id
Get detailed session information.

**Request**
```
GET /api/sessions/sess_abc123def456
Authorization: Bearer <access_token>
```

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "id": "sess_abc123def456",
    "name": "Podcast Episode 42",
    "status": "ready",
    "settings": {
      "chunk_size_ms": 600000,
      "preview_bitrate": 2000000
    },
    "devices": [
      {
        "id": "device_xyz",
        "label": "iPhone Pro",
        "kind": "phone",
        "status": "disconnected",
        "battery_percent": 85,
        "last_seen_at": "2026-05-03T13:15:00Z"
      },
      {
        "id": "device_abc",
        "label": "MacBook",
        "kind": "laptop",
        "status": "disconnected"
      }
    ],
    "chunks": [
      {
        "id": "chunk_0",
        "device_id": "device_xyz",
        "chunk_index": 0,
        "duration_ms": 600000,
        "file_size_bytes": 750000000,
        "upload_status": "completed",
        "uploaded_at": "2026-05-03T12:10:00Z"
      }
    ],
    "processing_jobs": [
      {
        "id": "job_1",
        "type": "sync",
        "status": "completed",
        "progress_percent": 100
      },
      {
        "id": "job_4",
        "type": "render",
        "status": "completed",
        "progress_percent": 100
      }
    ],
    "outputs": [
      {
        "id": "output_0",
        "format": "mp4_1080p",
        "s3_path": "sessions/sess_abc/output/final_1080p.mp4",
        "cdn_url": "https://cdn.podsoft.io/sess_abc/final_1080p.mp4",
        "duration_seconds": 4500,
        "file_size_bytes": 3600000000,
        "status": "completed"
      }
    ],
    "created_at": "2026-05-03T12:00:00Z",
    "stopped_at": "2026-05-03T13:15:00Z"
  }
}
```

---

#### POST /api/sessions/:id/start
Start recording on all connected devices.

**Request**
```
POST /api/sessions/sess_abc123def456/start
Authorization: Bearer <access_token>
```

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "session_id": "sess_abc123def456",
    "status": "recording",
    "recording_started_at": "2026-05-03T12:00:30Z",
    "devices_recording": 2,
    "devices_failed": 0
  }
}
```

**Errors**
- `400`: Session not in "prep" status
- `400`: No devices connected
- `409`: Already recording

---

#### POST /api/sessions/:id/pause
Pause recording (devices stay connected, can resume).

**Request**
```
POST /api/sessions/sess_abc123def456/pause
Authorization: Bearer <access_token>
```

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "session_id": "sess_abc123def456",
    "status": "paused",
    "paused_at": "2026-05-03T12:15:00Z"
  }
}
```

---

#### POST /api/sessions/:id/stop
Stop recording and finalize all chunks.

**Request**
```
POST /api/sessions/sess_abc123def456/stop
Authorization: Bearer <access_token>
```

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "session_id": "sess_abc123def456",
    "status": "stopped",
    "stopped_at": "2026-05-03T13:15:00Z",
    "final_chunk_count": 8,
    "total_duration_ms": 4500000,
    "estimated_processing_time_minutes": 120
  }
}
```

---

#### DELETE /api/sessions/:id
Archive/delete a session (soft delete; data retained 90 days).

**Request**
```
DELETE /api/sessions/sess_abc123def456
Authorization: Bearer <access_token>
```

**Response (204 No Content)**

---

### 2.3 Chunk Upload Endpoints

#### POST /api/sessions/:id/chunks
Request presigned S3 URL for chunk upload.

**Request**
```json
{
  "device_id": "device_xyz",
  "chunk_index": 0,
  "duration_ms": 600000,
  "file_size_bytes": 750000000,
  "hash": "sha256hash...",
  "filename": "chunk_0.mp4"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "chunk_id": "chunk_0",
    "s3_upload_url": "https://podsoft-recordings.s3.amazonaws.com/...",
    "upload_method": "PUT",
    "headers": {
      "Content-Type": "video/mp4",
      "x-amz-server-side-encryption": "AES256"
    },
    "expires_in_seconds": 3600
  }
}
```

---

#### GET /api/sessions/:id/chunks
List all chunks for a session.

**Query Parameters**
- `device_id`: Filter by device
- `status`: Filter by upload status
- `limit`: Items per page
- `offset`: Pagination offset

**Response (200 OK)**
```json
{
  "status": "success",
  "data": [
    {
      "id": "chunk_0",
      "session_id": "sess_abc",
      "device_id": "device_xyz",
      "chunk_index": 0,
      "duration_ms": 600000,
      "file_size_bytes": 750000000,
      "upload_status": "completed",
      "uploaded_at": "2026-05-03T12:10:00Z"
    }
  ],
  "meta": {
    "total": 8,
    "completed": 8,
    "pending": 0,
    "failed": 0
  }
}
```

---

#### GET /api/chunks/:id/status
Get real-time upload progress for a chunk.

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "chunk_id": "chunk_0",
    "upload_status": "uploading",
    "progress_percent": 45,
    "uploaded_bytes": 337500000,
    "total_bytes": 750000000,
    "speed_mbps": 12.5,
    "eta_seconds": 120
  }
}
```

---

### 2.4 Processing Endpoints

#### POST /api/sessions/:id/process
Enqueue processing jobs (sync, denoise, transcribe, render).

**Request**
```json
{
  "template_id": "tmpl_podcast",
  "jobs": ["sync", "denoise", "transcribe", "render"],
  "output_formats": ["mp4_1080p", "mp4_720p", "srt"],
  "options": {
    "target_loudness_lufs": -16,
    "denoise_strength": "medium",
    "color_profile": "standard"
  }
}
```

**Response (201 Created)**
```json
{
  "status": "success",
  "data": {
    "session_id": "sess_abc123def456",
    "job_ids": ["job_1", "job_2", "job_3", "job_4"],
    "estimated_completion_minutes": 120,
    "jobs": [
      {
        "id": "job_1",
        "type": "sync",
        "status": "queued",
        "priority": 1
      },
      {
        "id": "job_2",
        "type": "denoise",
        "status": "queued",
        "priority": 1
      },
      {
        "id": "job_3",
        "type": "transcribe",
        "status": "queued",
        "priority": 1
      },
      {
        "id": "job_4",
        "type": "render",
        "status": "queued",
        "priority": 1,
        "depends_on": ["job_1", "job_2", "job_3"]
      }
    ]
  }
}
```

---

#### GET /api/sessions/:id/jobs
List processing jobs for a session.

**Response (200 OK)**
```json
{
  "status": "success",
  "data": [
    {
      "id": "job_1",
      "type": "sync",
      "status": "completed",
      "progress_percent": 100,
      "started_at": "2026-05-03T13:16:00Z",
      "completed_at": "2026-05-03T13:21:00Z",
      "duration_seconds": 300,
      "result": {
        "sync_markers": [
          {
            "device_a": "device_xyz",
            "device_b": "device_abc",
            "offset_ms": 45,
            "confidence_percent": 99.2
          }
        ]
      }
    },
    {
      "id": "job_4",
      "type": "render",
      "status": "running",
      "progress_percent": 67,
      "started_at": "2026-05-03T13:30:00Z",
      "estimated_completion_seconds": 1200,
      "log_tail": ["Frame=5400...", "Estimated time: 20 seconds..."]
    }
  ]
}
```

---

#### GET /api/jobs/:id
Get detailed job information with progress and logs.

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "id": "job_4",
    "session_id": "sess_abc",
    "type": "render",
    "status": "running",
    "progress_percent": 67,
    "priority": 1,
    "attempts": 1,
    "max_attempts": 3,
    "started_at": "2026-05-03T13:30:00Z",
    "estimated_completion_seconds": 1200,
    "log": [
      "[13:30:00] Job started",
      "[13:30:05] Loading chunks from S3",
      "[13:31:00] Building FFmpeg filter graph",
      "[13:31:30] Starting encoding",
      "[13:45:00] Frame=5400 Current time: 180s (67%)"
    ]
  }
}
```

---

### 2.5 Template Endpoints

#### GET /api/templates
List available templates.

**Query Parameters**
- `kind`: Filter by template kind (podcast, interview, demo, reel)
- `public_only`: Only show public templates
- `owner`: Filter by user (self or specific user_id)

**Response (200 OK)**
```json
{
  "status": "success",
  "data": [
    {
      "id": "tmpl_podcast",
      "user_id": null,
      "name": "Podcast Side-by-Side",
      "kind": "podcast",
      "description": "Two speakers facing each other",
      "layout": {
        "canvas": { "w": 1920, "h": 1080 },
        "tracks": [
          { "device": "track_0", "x": 0, "y": 0, "w": 960, "h": 1080 },
          { "device": "track_1", "x": 960, "y": 0, "w": 960, "h": 1080 }
        ],
        "audio": { "mix": "sum", "ducking": false }
      },
      "is_public": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "tmpl_interview",
      "user_id": null,
      "name": "Interview: Host + Guest",
      "kind": "interview",
      "layout": {
        "canvas": { "w": 1920, "h": 1080 },
        "tracks": [
          { "device": "track_0", "x": 0, "y": 0, "w": 1280, "h": 1080, "label": "Host" },
          { "device": "track_1", "x": 1280, "y": 0, "w": 640, "h": 1080, "label": "Guest" }
        ]
      },
      "is_public": true
    }
  ]
}
```

---

#### POST /api/templates
Create a custom template.

**Request**
```json
{
  "name": "My Custom Layout",
  "kind": "podcast",
  "description": "Custom layout with logo watermark",
  "layout": {
    "canvas": { "w": 1920, "h": 1080 },
    "tracks": [
      { "device": "track_0", "x": 0, "y": 0, "w": 960, "h": 1080 },
      { "device": "track_1", "x": 960, "y": 0, "w": 960, "h": 1080 }
    ],
    "audio": { "mix": "sum" },
    "watermark": {
      "image_url": "https://...",
      "position": "bottom_right",
      "opacity": 0.8
    }
  },
  "is_public": false
}
```

**Response (201 Created)**
```json
{
  "status": "success",
  "data": {
    "id": "tmpl_custom_xyz",
    "user_id": "user_abc",
    "name": "My Custom Layout",
    "kind": "podcast",
    "created_at": "2026-05-03T12:00:00Z"
  }
}
```

---

### 2.6 Output Endpoints

#### GET /api/sessions/:id/outputs
List rendered outputs for a session.

**Response (200 OK)**
```json
{
  "status": "success",
  "data": [
    {
      "id": "output_0",
      "session_id": "sess_abc",
      "template_id": "tmpl_podcast",
      "output_type": "final",
      "format": "mp4_1080p",
      "duration_seconds": 4500,
      "file_size_bytes": 3600000000,
      "s3_path": "sessions/sess_abc/output/final_1080p.mp4",
      "cdn_url": "https://cdn.podsoft.io/output_0/final_1080p.mp4",
      "status": "completed",
      "metadata": {
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "bitrate": 8000000,
        "codec": "h264"
      },
      "created_at": "2026-05-03T13:30:00Z",
      "completed_at": "2026-05-03T15:30:00Z"
    }
  ]
}
```

---

#### GET /api/outputs/:id
Get output details with download/stream options.

**Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "id": "output_0",
    "cdn_url": "https://cdn.podsoft.io/output_0/final_1080p.mp4",
    "download_url": "https://api.podsoft.io/outputs/output_0/download?token=...",
    "stream_url": "https://cdn.podsoft.io/output_0/stream.m3u8",
    "thumbnail_url": "https://cdn.podsoft.io/output_0/thumb.jpg",
    "duration_seconds": 4500,
    "file_size_bytes": 3600000000,
    "format": "mp4_1080p",
    "status": "completed"
  }
}
```

---

#### POST /api/outputs/:id/publish
Publish output to external platforms.

**Request**
```json
{
  "platform": "youtube",
  "title": "My Podcast Episode 42",
  "description": "Check out this episode...",
  "tags": ["podcast", "tech", "interview"],
  "visibility": "public"
}
```

**Response (202 Accepted)**
```json
{
  "status": "success",
  "data": {
    "publish_job_id": "pub_xyz",
    "platform": "youtube",
    "status": "queued",
    "estimated_completion_minutes": 5
  }
}
```

---

## 3. WebSocket Events (Socket.IO)

### 3.1 Client → Server Events

```typescript
// Device Registration
socket.emit('device:register', {
  sessionId: 'sess_abc',
  deviceId: 'device_xyz',
  label: 'iPhone Pro',
  kind: 'phone',
  os: 'iOS',
  appVersion: '1.2.3'
});

// Device Status (heartbeat every 5s)
socket.emit('device:status', {
  deviceId: 'device_xyz',
  battery_percent: 75,
  storage_remaining_gb: 32,
  network_quality: 'excellent',
  recording_chunk_index: 5,
  audio_level_db: -12
});

// Chunk Ready for Upload
socket.emit('chunk:ready', {
  sessionId: 'sess_abc',
  deviceId: 'device_xyz',
  chunkIndex: 0,
  duration_ms: 600000,
  file_size_bytes: 750000000,
  hash: 'sha256...'
});

// Chunk Upload Progress
socket.emit('chunk:upload_progress', {
  chunkId: 'chunk_0',
  progress_percent: 45,
  speed_mbps: 12.5
});

// Chunk Upload Complete
socket.emit('chunk:uploaded', {
  chunkId: 'chunk_0',
  duration_ms: 600000,
  hash_verified: true
});

// Device Error
socket.emit('device:error', {
  code: 'STORAGE_FULL',
  message: 'Local storage full',
  recoverable: false
});
```

### 3.2 Server → Device Events

```typescript
// Start Recording Command
socket.emit('command:record_start', {
  sessionId: 'sess_abc',
  settings: {
    resolution: '1920x1080',
    framerate: 30,
    codec: 'h264',
    audioBitrate: 256000
  }
});

// Pause Recording
socket.emit('command:pause', {
  sessionId: 'sess_abc'
});

// Resume Recording
socket.emit('command:resume', {
  sessionId: 'sess_abc'
});

// Stop Recording
socket.emit('command:stop', {
  sessionId: 'sess_abc'
});

// Sync Marker (visual cue to tap)
socket.emit('command:sync_marker', {
  type: 'clap',
  timestamp: Date.now()
});

// Update Template
socket.emit('command:update_template', {
  templateId: 'tmpl_podcast',
  layout: {...}
});
```

### 3.3 Server → Studio Events

```typescript
// Device Connected
socket.emit('device:connected', {
  deviceId: 'device_xyz',
  label: 'iPhone Pro',
  kind: 'phone',
  os: 'iOS',
  signal_strength: 90,
  battery_percent: 75
});

// Device Disconnected
socket.emit('device:disconnected', {
  deviceId: 'device_xyz'
});

// Device Status Update
socket.emit('device:status_update', {
  deviceId: 'device_xyz',
  battery_percent: 70,
  storage_remaining_gb: 30,
  recording_state: 'recording',
  last_chunk_index: 5
});

// Session Status Change
socket.emit('session:status_changed', {
  sessionId: 'sess_abc',
  status: 'recording',
  active_devices: 2
});

// Chunk Uploaded
socket.emit('chunk:uploaded', {
  deviceId: 'device_xyz',
  chunkIndex: 0,
  duration_ms: 600000,
  file_size_bytes: 750000000
});

// Sync Status
socket.emit('session:sync_status', {
  sessionId: 'sess_abc',
  sync_ready: true,
  offsets: {
    device_xyz: 0,
    device_abc: 45
  }
});

// Processing Started
socket.emit('processing:started', {
  sessionId: 'sess_abc',
  jobs: ['sync', 'denoise', 'transcribe', 'render']
});

// Job Progress
socket.emit('job:progress', {
  jobId: 'job_4',
  type: 'render',
  progress_percent: 67,
  eta_seconds: 1200
});

// Job Completed
socket.emit('job:completed', {
  jobId: 'job_4',
  type: 'render',
  status: 'completed',
  output: {
    format: 'mp4_1080p',
    cdn_url: 'https://cdn.podsoft.io/...',
    duration_seconds: 4500
  }
});

// Processing Complete
socket.emit('processing:completed', {
  sessionId: 'sess_abc',
  outputs: [
    { format: 'mp4_1080p', cdn_url: '...' },
    { format: 'srt', cdn_url: '...' }
  ]
});
```

---

## 4. Error Handling

### 4.1 HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | GET request completed |
| 201 | Created | POST /sessions created new session |
| 202 | Accepted | POST /process enqueued job |
| 204 | No Content | DELETE successful |
| 400 | Bad Request | Invalid JSON or parameters |
| 401 | Unauthorized | Missing or invalid JWT |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Session ID doesn't exist |
| 409 | Conflict | Duplicate email, can't start recording |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Internal error |
| 503 | Service Unavailable | Maintenance or overload |

### 4.2 Error Response Format

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_SESSION_STATUS",
    "message": "Cannot start recording: session already recording",
    "details": {
      "current_status": "recording",
      "required_status": "prep"
    }
  },
  "meta": {
    "timestamp": "2026-05-03T12:00:00Z",
    "request_id": "req_xyz"
  }
}
```

### 4.3 Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | JWT missing or invalid |
| `FORBIDDEN` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_INPUT` | 400 | Malformed request |
| `INVALID_SESSION_STATUS` | 409 | Session in wrong state |
| `QUOTA_EXCEEDED` | 429 | Storage or processing quota exceeded |
| `DEVICE_NOT_FOUND` | 404 | Device not in session |
| `CHUNK_UPLOAD_FAILED` | 500 | S3 upload error |
| `PROCESSING_FAILED` | 500 | Job processing failed |
| `STORAGE_ERROR` | 500 | S3 or database error |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled exception |

---

**Document Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Last Review**: May 3, 2026  
**Next Review**: August 3, 2026

