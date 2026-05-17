# PodSoft — Technical Architecture Document

**Version:** 2.0  
**Status:** Production Ready  
**Last Updated:** May 2026  
**Audience:** Engineering, DevOps, Architects  
**Document Owner:** CTO

---

## Executive Summary

PodSoft's architecture follows a **cloud-native, event-driven, microservices-light** pattern optimized for:
- **Reliability**: Multi-region failover, data redundancy, fault tolerance
- **Scalability**: Horizontal scaling of API and worker nodes; auto-scaling based on queue depth
- **Cost Efficiency**: Lean container footprint, efficient chunked data flow, cold storage tiering
- **Maintainability**: Modular services, clear separation of concerns, infrastructure-as-code

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENTS LAYER                                   │
│  📱 iOS App        🤖 Android App        💻 Web Studio (Next.js)        │
│  React Native      React Native          React + WebSocket              │
└──────┬──────────────────┬─────────────────────────┬──────────────────────┘
       │                  │                         │
       └──────────────────┼─────────────────────────┘
                          │ HTTPS + WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    EDGE / CDN LAYER                                      │
│  CloudFlare or AWS CloudFront (DDoS, rate limiting, geo-routing)        │
└──────────────┬──────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY & LOAD BALANCER                           │
│  AWS ALB / Application Load Balancer (sticky sessions for WebSocket)    │
│  TLS 1.3 termination, request signing                                   │
└──────────────┬──────────────────────────────────────────────────────────┘
               │
    ┌──────────┴──────────────────────┬─────────────────────┐
    │                                  │                     │
    ▼                                  ▼                     ▼
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  API Servers     │  │  WebSocket Servers   │  │  Webhook / Events    │
│  (Express)       │  │  (Socket.IO)         │  │  (Bull Queue)        │
│  Autoscale:      │  │  Autoscale:          │  │                      │
│  4-64 instances  │  │  2-16 instances      │  │  Async job handlers  │
│                  │  │                      │  │                      │
│  • REST API      │  │  • Live updates      │  │  • Email sender      │
│  • Device mgmt   │  │  • Device status     │  │  • Integrations      │
│  • Chunk upload  │  │  • Recording state   │  │  • Webhooks          │
│  • Processing    │  │  • Sync updates      │  │  • Analytics         │
│    orchestration │  │                      │  │                      │
└──────────┬───────┘  └──────────┬───────────┘  └──────────┬───────────┘
           │                     │                        │
           └─────────────────────┼────────────────────────┘
                                 │
                    ┌────────────┴──────────────┐
                    │                           │
                    ▼                           ▼
          ┌──────────────────────┐  ┌──────────────────────┐
          │  Cache Layer         │  │  Database Layer      │
          │  (Redis Cluster)     │  │  (PostgreSQL)        │
          │                      │  │                      │
          │  • Session store     │  │  • User accounts     │
          │  • Device state      │  │  • Sessions metadata │
          │  • Processing queue  │  │  • Chunks metadata   │
          │  • Live preview buf  │  │  • Processing jobs   │
          │  • Rate limiting     │  │  • Templates         │
          │                      │  │  • Outputs           │
          └──────────────────────┘  └──────────────────────┘
                    │                           │
                    └───────────────┬───────────┘
                                    │
                      ┌─────────────┴──────────────┐
                      │                            │
                      ▼                            ▼
            ┌──────────────────────┐  ┌──────────────────────┐
            │  Object Storage      │  │  Archive Storage     │
            │  (S3 Hot)            │  │  (S3 Glacier)        │
            │  10 TB, 30-day TTL   │  │  Cold storage, 90d+  │
            │                      │  │                      │
            │  • Raw chunks        │  │  • Old sessions      │
            │  • Preview streams   │  │  • Archives          │
            │  • Processing inter  │  │                      │
            └──────────────────────┘  └──────────────────────┘
                    │
                    ▼
    ┌────────────────────────────────────────┐
    │  CDN (CloudFront)                      │
    │  Final video distribution              │
    │  1h TTL, geo-replicated                │
    └────────────────────────────────────────┘
                    │
                    ▼
            ┌──────────────────────┐
            │  Processing Workers  │
            │  (Python + FFmpeg)   │
            │                      │
            │  Autoscale:          │
            │  10-100 instances    │
            │                      │
            │  • Sync detection    │
            │  • Transcription     │
            │  • Color grading     │
            │  • Rendering        │
            │  • Denoise          │
            └──────────────────────┘
```

---

## 2. Core Components

### 2.1 API Server (Node.js + Express)

#### 2.1.1 Technology Stack
```
Framework: Express.js 4.18+
Runtime: Node.js 20.x LTS
HTTP: HTTP/2 (via Node native)
WebSocket: Socket.IO 4.5+
Database: node-postgres (pg)
Caching: ioredis
Job Queue: Bull
Logging: Pino with pretty-print (dev) / JSON (prod)
Error Tracking: Sentry
Monitoring: Prometheus client
Testing: Jest + Supertest
```

#### 2.1.2 Project Structure
```
backend/
├── src/
│   ├── index.ts                     # Entry point
│   ├── app.ts                       # Express app setup
│   ├── socket.ts                    # Socket.IO handlers
│   ├── config/                      # Configuration (env vars)
│   │   ├── index.ts
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── secrets.ts
│   ├── middleware/
│   │   ├── auth.ts                  # JWT validation
│   │   ├── errorHandler.ts          # Error handling
│   │   ├── metrics.ts               # Prometheus metrics
│   │   ├── rateLimit.ts             # Rate limiting
│   │   └── cors.ts                  # CORS config
│   ├── routes/
│   │   ├── auth.routes.ts           # /auth/*
│   │   ├── sessions.routes.ts       # /sessions/*
│   │   ├── devices.routes.ts        # /devices/*
│   │   ├── chunks.routes.ts         # /chunks/*
│   │   ├── processing.routes.ts     # /processing/*
│   │   ├── templates.routes.ts      # /templates/*
│   │   ├── outputs.routes.ts        # /outputs/*
│   │   ├── health.routes.ts         # /health/*
│   │   └── admin.routes.ts          # /admin/* (internal)
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── sessions.controller.ts
│   │   ├── devices.controller.ts
│   │   ├── chunks.controller.ts
│   │   ├── processing.controller.ts
│   │   └── ...
│   ├── services/
│   │   ├── user.service.ts
│   │   ├── session.service.ts
│   │   ├── device.service.ts
│   │   ├── chunk.service.ts
│   │   ├── processing.service.ts
│   │   ├── sync.service.ts
│   │   ├── storage.service.ts       # S3 interactions
│   │   ├── transcription.service.ts # OpenAI Whisper
│   │   ├── notification.service.ts
│   │   └── analytics.service.ts
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── session.model.ts
│   │   ├── device.model.ts
│   │   ├── chunk.model.ts
│   │   ├── processing_job.model.ts
│   │   ├── template.model.ts
│   │   └── output.model.ts
│   ├── queues/
│   │   ├── processing.queue.ts      # Bull queue definition
│   │   ├── transcription.queue.ts
│   │   ├── notification.queue.ts
│   │   └── workers/
│   │       ├── processing.worker.ts
│   │       └── ...
│   ├── types/
│   │   ├── index.ts                 # TypeScript interfaces
│   │   └── express.d.ts             # Express augmentation
│   └── utils/
│       ├── logger.ts
│       ├── crypto.ts
│       ├── validators.ts
│       ├── constants.ts
│       └── helpers.ts
├── db/
│   ├── migrations/
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_sessions.sql
│   │   ├── 003_create_devices.sql
│   │   ├── 004_create_chunks.sql
│   │   ├── 005_create_processing_jobs.sql
│   │   ├── 006_create_templates.sql
│   │   ├── 007_create_outputs.sql
│   │   └── 008_create_indexes.sql
│   └── seeds/
│       ├── seed_templates.sql
│       └── seed_defaults.sql
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── jest.config.js
└── .env.example
```

#### 2.1.3 Key Endpoints

**Sessions**
```typescript
// POST /api/sessions
// Request:
{
  name: "Podcast Episode 42",
  settings: {
    chunkSize: 600000,        // 10 min in ms
    preview_bitrate: 2000000, // 2 Mbps
    template: "podcast"
  }
}
// Response:
{
  status: "success",
  data: {
    id: "sess_abc123",
    user_id: "user_xyz",
    name: "Podcast Episode 42",
    status: "prep",
    created_at: "2026-05-03T12:00:00Z",
    join_token: "token_xyz"  // For devices to connect
  }
}

// GET /api/sessions/:id
// Returns: Full session details, device list, chunk summary

// POST /api/sessions/:id/start
// Transitions: prep → recording

// POST /api/sessions/:id/stop
// Transitions: recording/paused → stopped

// DELETE /api/sessions/:id
// Soft delete; moves to archived
```

**Devices**
```typescript
// POST /api/devices
// Register a recording device
{
  session_id: "sess_abc123",
  label: "iPhone Pro",
  kind: "phone",  // phone | laptop | camera | mic
  device_token: "token_xyz"  // Unique device identifier
}

// WebSocket events (Socket.IO):
// 'device:connected' → {deviceId, signal_strength, battery}
// 'device:disconnected' → {deviceId}
// 'device:status' → {deviceId, battery, storage_remaining, last_chunk_time}
```

**Chunks**
```typescript
// POST /api/sessions/:id/chunks
// Multipart upload with metadata
// Signed URL approach (preferred for large files)

// GET /api/sessions/:id/chunks
// Returns: Paginated chunk list with upload status

// GET /api/chunks/:id/status
// Returns: Upload progress {percent: 85, uploaded_bytes: 850MB, total_bytes: 1GB}
```

**Processing**
```typescript
// POST /api/sessions/:id/process
// Enqueue processing jobs
{
  template_id: "tmpl_podcast",
  jobs: ["sync", "denoise", "transcribe", "render"],
  output_formats: ["mp4_1080p", "mp4_720p", "srt"]
}

// GET /api/sessions/:id/jobs
// Returns: List of processing jobs with status + progress

// GET /api/jobs/:id
// Returns: Single job detail {type, status, progress %, log}
```

#### 2.1.4 Middleware Stack
```typescript
// Order matters!
app.use(cors(corsOptions));
app.use(helmet());                          // Security headers
app.use(express.json({ limit: '50mb' }));
app.use(requestLogger());                   // Pino logging
app.use(metricsMiddleware());               // Prometheus
app.use(rateLimiter());                     // Rate limiting
app.use(authenticateJWT);                   // Optional auth
app.use(errorHandler());                    // Catch-all error handler
```

---

### 2.2 WebSocket Layer (Socket.IO)

#### 2.2.1 Communication Architecture
```
Device connects to web studio:
1. Device establishes WebSocket to /ws?sessionId=xxx&deviceToken=yyy
2. Server validates token, associates device with session
3. Device emits: 'device:register' with metadata
4. Server broadcasts to studio: 'device:connected'
5. Device listens for: 'command:record_start', 'command:pause', etc.
6. Device emits live: 'device:status' every 5 seconds
```

#### 2.2.2 Event Definitions

**Device → Server**
```typescript
// Connection
socket.emit('device:register', {
  deviceId: 'device_xyz',
  label: 'iPhone Pro',
  kind: 'phone',
  os: 'iOS',
  osVersion: '17.4',
  appVersion: '1.2.3'
});

// Live status
socket.emit('device:status', {
  deviceId: 'device_xyz',
  battery_percent: 75,
  storage_remaining_gb: 32,
  network_quality: 'excellent',
  last_chunk_uploaded_ms: 300,
  audio_level_db: -12,
  timestamp: Date.now()
});

// Recording events
socket.emit('recording:chunk_ready', {
  chunkIndex: 5,
  duration_ms: 600000,
  file_size_bytes: 750000000,
  hash_sha256: 'abc123...',
  ready_for_upload: true
});

// Error events
socket.emit('device:error', {
  code: 'STORAGE_FULL',
  message: 'Local storage full',
  recoverable: false
});
```

**Server → Device**
```typescript
// Command to record
socket.emit('command:record_start', {
  sessionId: 'sess_abc',
  settings: {
    resolution: '1920x1080',
    framerate: 30,
    codec: 'h264',
    audioBitrate: 256000
  }
});

// Sync marker
socket.emit('command:sync_marker', {
  timestamp: Date.now(),
  markerType: 'visual'  // or 'audio'
});

// Update template
socket.emit('command:update_template', {
  templateId: 'tmpl_podcast',
  layout: {...}
});
```

**Studio → Server → All Devices**
```typescript
// Broadcast to all devices in session
io.to(`session_${sessionId}`).emit('session:update', {
  status: 'recording',
  activeDevices: ['device_a', 'device_b'],
  syncStatus: { device_a: 0, device_b: +45 }  // ms offset
});
```

#### 2.2.3 Socket.IO Configuration
```typescript
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  },
  transports: ['websocket', 'polling'],  // Fallback to polling
  pingInterval: 30000,                    // 30s heartbeat
  pingTimeout: 5000,                      // 5s timeout
  maxHttpBufferSize: 1e7,                 // 10MB max message size
  // Adapter for horizontal scaling
  adapter: createAdapter(pubClient, subClient)  // Redis pub/sub
});
```

---

### 2.3 Database Layer (PostgreSQL)

#### 2.3.1 Core Schema

**users**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  oauth_provider VARCHAR(50),         -- 'google', 'github', 'apple'
  oauth_id VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  plan VARCHAR(50) DEFAULT 'free',   -- 'free', 'pro', 'studio', 'enterprise'
  storage_quota_gb BIGINT DEFAULT 10,
  processing_quota_hours BIGINT DEFAULT 10,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'suspended', 'deleted'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_oauth (oauth_provider, oauth_id),
  INDEX idx_plan (plan)
);

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'prep',
  -- 'prep' → 'recording' → 'paused' → 'recording' → 'stopped' → 'processing' → 'ready' → 'archived'
  settings JSONB DEFAULT '{}',
  -- {chunkSize, previewBitrate, template, colorProfile, audioSettings}
  stats JSONB,
  -- {totalDuration, totalSize, syncAccuracy, processingTime}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  stopped_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_sessions (user_id, created_at DESC),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at DESC)
);

CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  label VARCHAR(100),
  kind VARCHAR(50),  -- 'phone', 'laptop', 'camera', 'mic'
  device_token VARCHAR(255) UNIQUE NOT NULL,
  os VARCHAR(50),    -- 'iOS', 'Android', 'macOS', 'Windows'
  os_version VARCHAR(50),
  app_version VARCHAR(50),
  status VARCHAR(50) DEFAULT 'disconnected',  -- 'connected', 'recording', 'error'
  battery_percent INT,
  storage_remaining_gb INT,
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  INDEX idx_session_devices (session_id),
  INDEX idx_device_token (device_token),
  UNIQUE(session_id, device_token)
);

CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  device_id INTEGER NOT NULL REFERENCES devices(id),
  chunk_index INT,
  duration_ms INT,
  ts_start TIMESTAMP,
  ts_end TIMESTAMP,
  file_size_bytes BIGINT,
  file_hash VARCHAR(255),           -- SHA256 for verification
  s3_path VARCHAR(500),             -- sessions/{sessionId}/{deviceId}/chunk_{index}.mp4
  upload_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'uploading', 'completed', 'failed'
  upload_error TEXT,
  codec VARCHAR(50),                -- 'h264', 'hevc'
  video_width INT,
  video_height INT,
  video_bitrate INT,
  audio_bitrate INT,
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_at TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_session_chunks (session_id, chunk_index),
  INDEX idx_device_chunks (device_id, chunk_index),
  INDEX idx_upload_status (upload_status),
  UNIQUE(session_id, device_id, chunk_index)
);

CREATE TABLE processing_jobs (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  job_type VARCHAR(50),             -- 'sync', 'denoise', 'transcribe', 'render', 'color_grade'
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
  progress_percent INT DEFAULT 0,
  priority INT DEFAULT 3,
  error_message TEXT,
  result JSONB,                     -- Job-specific output
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  INDEX idx_session_jobs (session_id, job_type),
  INDEX idx_status (status),
  INDEX idx_priority (priority DESC, created_at ASC)
);

CREATE TABLE templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),  -- NULL for default templates
  name VARCHAR(255),
  kind VARCHAR(50),                 -- 'podcast', 'interview', 'demo', 'reel'
  description TEXT,
  layout JSONB,                     -- {canvas, tracks, audio, captions, effects}
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_kind (kind),
  INDEX idx_user (user_id)
);

CREATE TABLE outputs (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  template_id INTEGER REFERENCES templates(id),
  output_type VARCHAR(50),         -- 'raw', 'final', 'clip', 'reel'
  format VARCHAR(50),              -- 'mp4_1080p', 'mp4_720p', 'srt', 'gif'
  duration_seconds INT,
  file_size_bytes BIGINT,
  s3_path VARCHAR(500),            -- sessions/{sessionId}/output/{outputId}.mp4
  cdn_url VARCHAR(500),            -- https://cdn.podsoft.io/...
  status VARCHAR(50) DEFAULT 'processing',  -- 'processing', 'completed', 'failed'
  progress_percent INT DEFAULT 0,
  video_width INT,
  video_height INT,
  video_bitrate INT,
  error_message TEXT,
  metadata JSONB,                  -- {thumbnail_url, duration, fps}
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
  INDEX idx_session_outputs (session_id, output_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at DESC)
);

CREATE TABLE transcriptions (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  language VARCHAR(10) DEFAULT 'en',
  transcript_json JSONB,           -- [{time, text, speaker}]
  srt_content TEXT,                -- WebVTT/SRT format
  speaker_labels JSONB,            -- {speaker_0: name, speaker_1: name}
  s3_path_json VARCHAR(500),
  s3_path_srt VARCHAR(500),
  accuracy_percent INT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  INDEX idx_session (session_id),
  UNIQUE(session_id, language)
);

CREATE TABLE sync_markers (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  device_id_a INTEGER NOT NULL REFERENCES devices(id),
  device_id_b INTEGER NOT NULL REFERENCES devices(id),
  marker_type VARCHAR(50),         -- 'clap', 'visual', 'audio'
  offset_ms INT,                   -- Device B offset relative to Device A
  confidence_percent INT,          -- 0-100
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  INDEX idx_session_markers (session_id)
);

-- Indexes for common queries
CREATE INDEX idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX idx_chunks_session_status ON chunks(session_id, upload_status);
CREATE INDEX idx_jobs_session_status ON processing_jobs(session_id, status);
```

#### 2.3.2 Connection Pool & Performance
```typescript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 100,                      // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,      // Cancel slow queries
  application_name: 'podsoft-api'
});

// Health check
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    logger.error('DB health check failed', err);
  }
}, 60000);
```

---

### 2.4 Cache Layer (Redis)

#### 2.4.1 Redis Architecture
```
Redis Cluster (3 nodes, 64GB total)
├── Node 1: Master (slots 0-5460)
├── Node 2: Master (slots 5461-10922)
└── Node 3: Master (slots 10923-16383)

Each master has a replica for failover
```

#### 2.4.2 Cache Keys & TTL

| Key Pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `session:{sessionId}` | JSON session object | 24h | Session metadata cache |
| `device:{deviceId}:status` | {battery, storage, lastSeen} | 5 min | Device status |
| `user:{userId}:quota` | {storageUsed, processingUsed} | 1h | Quota calculation |
| `processing:queue:{jobId}` | Job metadata | Until completion | Job queue tracking |
| `ratelimit:{userId}:{endpoint}` | Request count | 60s | Rate limiting |
| `upload:signing:{chunkId}` | Presigned URL | 15 min | S3 upload URLs |
| `preview:stream:{sessionId}:{deviceId}` | MJPEG stream buffer | 30s | Live preview cache |
| `sync:offsets:{sessionId}` | {deviceId: offsetMs} | 24h | Sync results cache |

#### 2.4.3 Usage Example
```typescript
// Cache session
const key = `session:${sessionId}`;
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);

const session = await db.query('SELECT * FROM sessions WHERE id = ?', [sessionId]);
await redis.setex(key, 86400, JSON.stringify(session));  // 24h TTL
return session;

// Increment rate limit counter
const limitKey = `ratelimit:${userId}:${endpoint}`;
const count = await redis.incr(limitKey);
if (count === 1) await redis.expire(limitKey, 60);
if (count > 100) throw new RateLimitError();
```

---

### 2.5 Job Queue (Bull + Redis)

#### 2.5.1 Queue Architecture
```
Bull Job Queue (Redis-backed)
├── processing:queue (sync, denoise, render)
├── transcription:queue (Whisper API calls)
├── notification:queue (emails, webhooks)
└── analytics:queue (data aggregation)

Jobs are serialized as JSON and stored in Redis
Workers consume jobs from queue heads
Failed jobs are retried with exponential backoff
```

#### 2.5.2 Processing Queue Definition
```typescript
const processingQueue = new Queue('processing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000  // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 3600,  // Keep completed jobs for 1h
      isPattern: false
    },
    removeOnFail: {
      age: 86400  // Keep failed jobs for 24h
    }
  }
});

// Enqueue a job
const job = await processingQueue.add(
  'render_template',
  {
    sessionId: 'sess_abc',
    templateId: 'tmpl_podcast',
    outputFormat: 'mp4_1080p'
  },
  {
    priority: 1,  // High priority
    attempts: 2,
    backoff: { type: 'exponential', delay: 1000 }
  }
);

// Listen for completion
job.on('completed', (result) => {
  logger.info('Job completed', { jobId: job.id, result });
});

job.on('failed', (err) => {
  logger.error('Job failed', { jobId: job.id, error: err.message });
});
```

#### 2.5.3 Worker Process
```typescript
// Separate process (worker.js)
const processingQueue = new Queue('processing');

processingQueue.process('render_template', async (job) => {
  const { sessionId, templateId, outputFormat } = job.data;
  
  try {
    job.progress(0);
    
    // Fetch chunks from S3
    const chunks = await fetchSessionChunks(sessionId);
    job.progress(10);
    
    // Render video with FFmpeg
    const outputPath = await renderTemplate(chunks, templateId, outputFormat, (progress) => {
      job.progress(progress);  // Update progress
    });
    job.progress(90);
    
    // Upload to S3
    const s3Path = await uploadToS3(outputPath);
    job.progress(95);
    
    // Update database
    await updateOutput(sessionId, { s3Path, status: 'completed' });
    job.progress(100);
    
    return { s3Path, duration: '01:23:45' };
  } catch (err) {
    logger.error('Job failed', { jobId: job.id, error: err });
    throw err;  // Bull will retry
  }
});
```

---

### 2.6 Storage Layer (S3)

#### 2.6.1 Bucket Configuration
```
Primary Bucket (podsoft-recordings)
├── Versioning: Enabled
├── Encryption: AES-256 (SSE-S3)
├── Public Access: Blocked
├── Lifecycle Rules:
│   └── Move to Glacier after 90 days
├── Replication: Cross-region (to backup bucket)
└── CORS: Restricted to podsoft.io domains

Archive Bucket (podsoft-archive)
├── Storage Class: Glacier Deep Archive
├── Lifecycle: Retain for 7 years
├── No public access
└── Minimal cost ($0.004/GB/month)
```

#### 2.6.2 Object Key Structure
```
sessions/{sessionId}/
├── raw/
│   ├── {deviceId}/
│   │   ├── chunk_0000.mp4
│   │   ├── chunk_0001.mp4
│   │   └── chunk_0002.mp4
│   └── {deviceId}/
│       └── ...
├── preview/
│   ├── {deviceId}_preview.m3u8
│   ├── {deviceId}_preview_chunk_0.ts
│   └── ...
├── processed/
│   ├── sync_offsets.json
│   ├── denoise_profile.json
│   └── transcription.srt
└── output/
    ├── final_1080p.mp4
    ├── final_720p.mp4
    ├── reel_vertical.mp4
    └── final.srt
```

#### 2.6.3 Upload Strategy
```typescript
// Presigned URL approach (preferred)
const s3 = new AWS.S3();

// Generate signed URL for device to upload directly
const presignedUrl = s3.getSignedUrl('putObject', {
  Bucket: 'podsoft-recordings',
  Key: `sessions/${sessionId}/raw/${deviceId}/chunk_${index}.mp4`,
  Expires: 3600,  // 1 hour
  ContentType: 'video/mp4'
});

// Return URL to device; device uploads directly to S3
// Server monitors upload completion via S3 events (SNS notifications)

// S3 → SNS → SQS → Worker → Database update
```

#### 2.6.4 Cost Optimization
```
Storage costs (example 100 sessions/month, 20GB each):
- Hot storage (30 days): 2TB @ $0.023/GB = $46/month
- Glacier (90 days): 2TB @ $0.004/GB = $8/month
- Data retrieval (10% accessed): 200GB @ $0.02/GB = $4/month
Total: ~$58/month for 100 sessions

Bandwidth:
- Inbound (uploads): Free
- Outbound (via CloudFront): ~$0.085/GB after 10TB free
- Example: 1TB/month outbound = $85/month
```

---

### 2.7 Processing Workers (Python)

#### 2.7.1 Technology Stack
```
Runtime: Python 3.11
Task Framework: Celery (or direct Redis consumer)
Video Processing: FFmpeg (via subprocess)
AI/ML: OpenAI Whisper API
Audio Processing: librosa, pydub
Image Processing: OpenCV
Data: pandas, numpy
Logging: structlog (JSON output)
Monitoring: Prometheus Python client
```

#### 2.7.2 Worker Architecture
```
Worker Container (8 vCPU, 32GB RAM)
├── FFmpeg process (2 GPU, 8 threads)
├── Memory buffer (16GB for chunked video)
└── Temporary storage (2TB ephemeral disk)

Autoscaling:
- Min: 10 instances
- Max: 100 instances
- Scale trigger: Queue depth >1h
- Cooldown: 5 minutes
```

#### 2.7.3 Processing Pipeline
```python
# 1. Sync Detection
def detect_sync_offsets(chunks_metadata):
    """
    Detect temporal offset between devices using:
    - Audio cross-correlation
    - Visual sync markers (clap detection)
    - Manual sync markers (if user marked)
    """
    offsets = {}
    for device_a, device_b in itertools.combinations(device_list, 2):
        audio_a = load_audio(chunks[device_a])
        audio_b = load_audio(chunks[device_b])
        
        # Cross-correlation
        offset = estimate_offset(audio_a, audio_b)
        offsets[device_b] = offset
    
    return offsets

# 2. Denoise
def denoise_audio(chunks, target_lufs=-16):
    """
    - Estimate noise profile from quiet sections
    - Apply spectral subtraction
    - Normalize loudness to LUFS standard
    """
    result = []
    for chunk in chunks:
        audio = load_audio(chunk)
        denoised = spectral_subtraction(audio, noise_profile)
        normalized = normalize_loudness(denoised, target_lufs)
        result.append(normalized)
    return result

# 3. Transcription
def transcribe_session(audio_chunks):
    """
    Call OpenAI Whisper API for each chunk
    Return: SRT + JSON with speaker labels
    """
    srt_data = []
    current_time = 0
    
    for chunk in audio_chunks:
        response = openai.Audio.transcribe(
            model='whisper-1',
            file=chunk,
            language='en',
            response_format='verbose_json'
        )
        
        for segment in response['segments']:
            srt_data.append({
                'start_time': current_time + segment['start'],
                'end_time': current_time + segment['end'],
                'text': segment['text']
            })
        
        current_time += chunk_duration
    
    return generate_srt(srt_data)

# 4. Rendering
def render_template(chunks, template, offsets, output_format='mp4_1080p'):
    """
    Build FFmpeg filter graph:
    - Scale videos to canvas size
    - Apply audio sync offsets
    - Mix audio tracks
    - Render to specified format
    """
    filter_graph = build_filter_graph(chunks, template, offsets)
    
    cmd = [
        'ffmpeg',
        '-i', chunks[0],
        '-i', chunks[1],
        # ... more inputs
        '-filter_complex', filter_graph,
        '-c:v', 'h264',
        '-preset', 'fast',
        '-b:v', '8000k',
        '-c:a', 'aac',
        '-b:a', '256k',
        output_path
    ]
    
    subprocess.run(cmd)
    return output_path
```

#### 2.7.4 Error Handling & Monitoring
```python
import logging
from prometheus_client import Counter, Histogram

processing_duration = Histogram(
    'podsoft_processing_duration_seconds',
    'Processing job duration',
    ['job_type'],
    buckets=[60, 300, 900, 1800, 3600]
)

processing_errors = Counter(
    'podsoft_processing_errors_total',
    'Failed processing jobs',
    ['job_type', 'error_type']
)

@processing_duration.labels('render').time()
def render_with_monitoring(chunks, template):
    try:
        return render_template(chunks, template)
    except Exception as e:
        processing_errors.labels('render', type(e).__name__).inc()
        logger.error('Rendering failed', exc_info=True)
        raise
```

---

## 3. Data Flow Diagrams

### 3.1 Recording Session Flow
```
┌─────────────────────────────────────────────────────────────┐
│                     DEVICE (Phone/Laptop)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Start Recording                                    │  │
│  │    • Begin H.264 encoding to local file               │  │
│  │    • Start audio capture + AAC encoding               │  │
│  │    • Initialize rolling 10-min buffer in memory       │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │                                      │
│  ┌───────────────────▼─────────────────────────────────┐  │
│  │ 2. Every 10 Minutes                                  │  │
│  │    • Finalize current chunk_{N}.mp4                  │  │
│  │    • Begin next chunk_{N+1}.mp4                      │  │
│  │    • Compute SHA256(chunk_N), file size, metadata    │  │
│  │    • Create chunk_N.meta.json                        │  │
│  │    • Store in local cache (fallback)                 │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │                                      │
│  ┌───────────────────▼─────────────────────────────────┐  │
│  │ 3. Upload Chunk (Background)                         │  │
│  │    • Request presigned S3 URL from API               │  │
│  │    • Start multipart upload to S3                    │  │
│  │    • Emit 'chunk:upload_progress' to server (5% inc) │  │
│  │    • On completion: emit 'chunk:uploaded'            │  │
│  │    • On failure: retry with exponential backoff      │  │
│  │    • Queue for batch upload if network offline       │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │                                      │
│                      ▼                                      │
│           HTTPS WebSocket / HTTPS                          │
│         (Upload chunks in parallel)                        │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVER (API)                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Chunk Received                                     │  │
│  │    • Validate SHA256 hash                            │  │
│  │    • Update chunks table: status = 'completed'       │  │
│  │    • Log to Prometheus: chunk_upload_duration        │  │
│  │    • Broadcast via WebSocket to studio: update       │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │                                      │
│  ┌───────────────────▼─────────────────────────────────┐  │
│  │ 2. Chunk Organization                                │  │
│  │    • Organize chunks by (sessionId, deviceId, idx)   │  │
│  │    • Cache chunk metadata in Redis                   │  │
│  │    • Detect if all devices have uploaded chunk N     │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │                                      │
│                      ▼                                      │
│        Session Stored in PostgreSQL                        │
│        + Redis cache for fast queries                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Processing Pipeline Flow
```
┌────────────────────────────────────────────────────┐
│  Session Stopped → Chunks finalized                │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Enqueue Jobs       │
         │ • sync             │
         │ • denoise          │
         │ • transcribe       │
         │ • render           │
         └────────┬───────────┘
                  │
       ┌──────────┼──────────┐
       │          │          │
       ▼          ▼          ▼
    ┌────┐    ┌────┐    ┌─────────┐
    │ A  │    │ B  │    │ Bull Q  │
    │ B  │    │ B  │    │ (Redis) │
    └─┬──┘    └─┬──┘    └──┬──────┘
      │        │          │
      └────────┼──────────┘
               │
       ┌───────▼────────┐
       │ Worker Picks   │
       │ from Queue     │
       └───────┬────────┘
               │
    ┌──────────┴──────────────────┐
    │                             │
    ▼                             ▼
┌──────────────┐         ┌──────────────────┐
│ Sync Detect  │         │ Parallel: Denoise│
│              │         │ + Transcribe     │
│ • Load chunks│         │                  │
│ • Find offset│         │ • Audio → Whisper│
│ • Store in DB│         │ • Denoise filter │
└──────┬───────┘         └────────┬─────────┘
       │                          │
       └──────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────┐
         │ Render (Template)  │
         │                    │
         │ • Load chunks      │
         │ • Apply sync offse│
         │ • Build FFmpeg filt
         │ • Render to mp4    │
         │ • Upload to S3     │
         └────────┬───────────┘
                  │
                  ▼
      ┌──────────────────────┐
      │ Update Session       │
      │ status = 'ready'     │
      │ Notify User          │
      └──────────────────────┘
```

---

## 4. Deployment Architecture

### 4.1 Infrastructure Tiers

**Development**
```yaml
API Servers: 1 instance (4 vCPU, 8 GB RAM)
Workers: 1 instance (2 vCPU, 4 GB RAM)
Database: Single node PostgreSQL (50GB)
Redis: Single node (8GB)
S3: Regular storage (lifecycle disabled)
Cost: ~$200/month
```

**Staging**
```yaml
API Servers: 2 instances (4 vCPU, 8 GB RAM each)
Workers: 2 instances (4 vCPU, 16 GB RAM each)
Database: Multi-AZ PostgreSQL (100GB)
Redis: 2-node cluster (16GB)
S3: Versioning + replication enabled
ALB: 1 shared ALB
Cost: ~$800/month
```

**Production**
```yaml
API Servers: 8 instances (4 vCPU, 16 GB RAM each)
  → Autoscale: 4–16 based on CPU >70%
Workers: 20 instances (8 vCPU, 32 GB RAM each)
  → Autoscale: 10–100 based on queue depth >1h
Database: Multi-AZ PostgreSQL (500GB) + read replica
Redis: 3-node cluster (64GB) + replication
S3: Multi-region, lifecycle to Glacier
ALB: DDoS-protected, auto-scaling
CDN: CloudFront distribution
Cost: ~$5,000/month baseline
```

### 4.2 Container Images

**API Server (Dockerfile.api)**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci --only=production

# Source
COPY src ./src
COPY db ./db
COPY dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run
CMD ["node", "dist/index.js"]
```

**Worker (Dockerfile.worker)**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
  ffmpeg \
  libsndfile1 \
  libopus0 \
  && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source
COPY worker.py .
COPY processing/ ./processing

# Run
CMD ["python", "-u", "worker.py"]
```

**Web Studio (Dockerfile.web)**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4.3 Kubernetes / ECS Deployment

**ECS Task Definition (podsoft-api.json)**
```json
{
  "family": "podsoft-api",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "podsoft:api-latest",
      "cpu": 1024,
      "memory": 4096,
      "portMappings": [
        { "containerPort": 3001, "protocol": "tcp" }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "LOG_LEVEL", "value": "info" }
      ],
      "secrets": [
        { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:...:database_url" },
        { "name": "REDIS_URL", "valueFrom": "arn:aws:secretsmanager:...:redis_url" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/podsoft-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 30
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "1024",
  "memory": "4096"
}
```

---

## 5. Security & Compliance

### 5.1 Authentication Flow

```
1. User logs in
   POST /auth/login {email, password}
   ↓
2. Server validates credentials (bcrypt)
   ↓
3. Generate JWT token (RS256 signed)
   {
     "sub": "user_123",
     "email": "user@example.com",
     "plan": "pro",
     "iat": 1234567890,
     "exp": 1234654290
   }
   ↓
4. Return token + refresh token (30d)
   Client stores in secure storage
   ↓
5. Client sends JWT in Authorization header
   Authorization: Bearer eyJhbGciOiJSUzI1NiI...
   ↓
6. Server verifies JWT signature + expiry
   ↓
7. Extract user_id from token payload
```

### 5.2 Data Encryption

| Layer | Method | Details |
|-------|--------|---------|
| **In Transit** | TLS 1.3 | All HTTP, WebSocket, S3 uploads |
| **At Rest (DB)** | AWS KMS | Column-level encryption for PII |
| **At Rest (S3)** | AES-256-GCM | All objects encrypted with customer key |
| **Backups** | AES-256 | Daily snapshots encrypted separately |
| **Preview Stream** | HTTPS only | No unencrypted video preview |

### 5.3 Rate Limiting

```typescript
// Per-user limits
const limits = {
  'free': { requests: 100, uploads: 10, sessions: 5 },
  'pro': { requests: 1000, uploads: 100, sessions: 50 },
  'enterprise': { requests: 10000, uploads: 1000, sessions: 1000 }
};

// Token bucket algorithm
async function checkRateLimit(userId, action) {
  const key = `ratelimit:${userId}:${action}`;
  const allowance = limits[getUserPlan(userId)][action];
  
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, 3600);
  
  if (current > allowance) throw new RateLimitError(`Exceeded ${action} limit`);
}
```

---

## 6. Monitoring & Alerting

### 6.1 Key Metrics (Prometheus)

```yaml
# API Metrics
podsoft_api_requests_total{method,status,endpoint}
podsoft_api_duration_seconds{endpoint,quantile}  # p50, p95, p99
podsoft_api_errors_total{error_type}
podsoft_http_request_size_bytes{}
podsoft_http_response_size_bytes{}

# Session Metrics
podsoft_sessions_total{plan}
podsoft_active_sessions{plan}
podsoft_session_duration_seconds{}

# Recording Metrics
podsoft_chunks_uploaded_total
podsoft_chunk_upload_duration_seconds
podsoft_chunk_size_bytes{quantile}
podsoft_upload_failures_total{error}

# Processing Metrics
podsoft_processing_jobs_total{job_type,status}
podsoft_processing_duration_seconds{job_type}
podsoft_sync_accuracy_percent{}
podsoft_transcription_error_rate{}

# Database Metrics
podsoft_db_connections{state}
podsoft_db_query_duration_seconds{}
podsoft_db_errors_total

# Cache Metrics
podsoft_redis_operations_total{operation}
podsoft_redis_duration_seconds{}
podsoft_cache_hit_ratio{}

# Storage Metrics
podsoft_s3_upload_duration_seconds
podsoft_s3_objects_total
podsoft_s3_storage_bytes{bucket}
```

### 6.2 Alerting Rules

```yaml
groups:
  - name: podsoft_critical
    interval: 1m
    rules:
      - alert: HighErrorRate
        expr: rate(podsoft_api_errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        annotations:
          summary: "PostgreSQL is down"
          
      - alert: ProcessingBacklog
        expr: histogram_quantile(0.95, podsoft_job_queue_depth_seconds) > 3600
        for: 30m
        annotations:
          summary: "Processing backlog > 1 hour"
          
      - alert: StorageFull
        expr: podsoft_s3_storage_bytes / podsoft_s3_quota_bytes > 0.95
        for: 5m
        annotations:
          summary: "S3 storage nearly full"
```

---

## 7. Disaster Recovery & Backup

### 7.1 Recovery Time Objectives (RTO) & Recovery Point Objectives (RPO)

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| **Database** | 1 min | 6 hours | Multi-AZ replica + 6-hourly snapshots |
| **API Server** | 5 min | 0 | Stateless; autoscaling handles failure |
| **Cache** | 30 sec | 1 min | In-memory, acceptable data loss |
| **S3 Storage** | 5 min | 0 | Cross-region replication |
| **Session Data** | 1 hour | 30 min | Cached in Redis + DB |

### 7.2 Backup Strategy

```bash
# Daily automated backups
# Database: 30-day retention
# Schedule: 2 AM UTC daily
# Cross-region: Replicate to backup region

# S3 versioning: Keep last 30 versions per object
# S3 replication: Real-time sync to backup bucket

# Transaction logs: 7-day retention
# WAL archiving: Every 16MB or 5 minutes

# Disaster drill: Monthly failover simulation
```

### 7.3 Failover Procedure

```
Failure Detection (monitoring):
  └─ Alert triggered: Critical service down
     │
  ├─ Notify on-call engineer (PagerDuty)
  │
  └─ Automatic actions:
     ├─ Stop traffic to failed region (DNS failover)
     ├─ Restore DB from latest snapshot
     ├─ Spin up new API instances in backup region
     ├─ Restore session state from Redis backup
     └─ Monitor recovery metrics
     
Recovery Verification:
  ├─ Smoke tests passing
  ├─ API responding to requests
  ├─ Database connections healthy
  └─ WebSocket connections re-established
  
Timeline: <5 minutes total (RTO)
```

---

## 8. Deployment Playbook

### 8.1 Blue-Green Deployment

```bash
# 1. Build new image
docker build -t podsoft:api-v1.2.3 -f Dockerfile.api .

# 2. Push to registry
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:api-v1.2.3

# 3. Create new ECS task definition
aws ecs register-task-definition --cli-input-json file://task-def-v1.2.3.json

# 4. Update "green" service
aws ecs update-service \
  --cluster podsoft-prod \
  --service podsoft-api-green \
  --task-definition podsoft-api:2

# 5. Wait for deployment
aws ecs wait services-stable --cluster podsoft-prod --services podsoft-api-green

# 6. Run smoke tests against green
npm run test:smoke --baseUrl=https://green.api.podsoft.io

# 7. If tests pass: Switch traffic from blue to green
aws elasticloadbalancing modify-listener \
  --listener-arn arn:aws:elasticloadbalancing:...
  --default-actions Type=forward,TargetGroupArn=arn:...:targetgroup/green/...

# 8. Monitor for 30 minutes
watch -n 5 'aws cloudwatch get-metric-statistics --metric-name TargetResponseTime ...'

# 9. On error: Roll back to blue
aws elasticloadbalancing modify-listener \
  --listener-arn arn:aws:elasticloadbalancing:...
  --default-actions Type=forward,TargetGroupArn=arn:...:targetgroup/blue/...
```

### 8.2 Rollback Procedure

```bash
# If deployment fails:

# 1. Detect failure
# (Automated: error rate > 5% or latency spike)

# 2. Immediate rollback
aws ecs update-service \
  --cluster podsoft-prod \
  --service podsoft-api-blue \
  --force-new-deployment

# 3. Verify rollback
curl https://api.podsoft.io/health
echo "✓ API healthy, rolled back to previous version"

# 4. Post-mortem
# - Review logs for failure cause
# - Document issue
# - Update deployment checklist
```

---

## Appendix: Configuration Reference

### Environment Variables (.env)

```bash
# Server
NODE_ENV=production
API_PORT=3001
API_HOST=0.0.0.0
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@db.example.com:5432/podsoft
DB_POOL_SIZE=100
DB_IDLE_TIMEOUT=30000

# Redis
REDIS_URL=redis://cache-cluster.example.com:6379
REDIS_PASSWORD=password
REDIS_KEY_PREFIX=podsoft:

# S3
AWS_REGION=us-east-1
S3_BUCKET_RECORDINGS=podsoft-recordings
S3_BUCKET_ARCHIVE=podsoft-archive
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# OpenAI (Transcription)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=whisper-1

# JWT
JWT_SECRET=random-secret-key-min-32-chars
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=30d

# CORS
CORS_ORIGINS=https://studio.podsoft.io,https://app.podsoft.io

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
PROMETHEUS_ENABLED=true

# Features
FEATURE_LIVE_STREAMING=true
FEATURE_CLIP_MAKER=true
FEATURE_WEBHOOK_INTEGRATIONS=true
```

---

**Document Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Last Review**: May 3, 2026  
**Next Review**: August 3, 2026

