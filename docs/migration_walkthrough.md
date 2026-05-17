# PodSoft Pro - Migration & Modular Architecture Summary

We have fully upgraded **PodSoft Pro** into a production-grade modular full-stack application backed by **Supabase**.

## 1. Modular Directory Structure

```
PODSOFT_V1/
├── backend/                  # Standalone API & WebRTC Signaling Server
│   ├── package.json
│   ├── server.ts             # Express on port 3001, Socket.io, Gemini AI, DroidCam Proxy
│   ├── tsconfig.json
│   └── .env                  # Backend credentials (SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY)
├── frontend/                 # Standalone React + Vite Mobile/Web Studio
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts        # Proxies /api and /socket.io to backend port 3001
│   ├── tsconfig.json
│   ├── package.json
│   └── .env                  # Frontend credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
├── docs/                     # Documentation Archive
│   ├── prd.md
│   ├── copy.md
│   ├── follow.md
│   ├── security_spec.md
│   └── migration_walkthrough.md
├── supabase-schema.sql       # Double-quoted DDL schema for Supabase SQL Editor
├── package.json              # Orchestrates dev and build across frontend & backend via Concurrently
└── .env                      # Root environment variables
```

## 2. Running Development Server

To run the complete full-stack application (both Frontend and Backend simultaneously):
```bash
npm run dev
```

This runs:
1. `backend`: `tsx server.ts` on `http://localhost:3001`
2. `frontend`: `vite` on `http://localhost:3000` (proxying API and WebSockets transparently to port 3001).

## 3. Supabase SQL Schema (Double-Quoted Fix)

To create all necessary tables with mixed-case preservation in PostgreSQL, execute the following SQL in your Supabase SQL Editor:

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    "displayName" TEXT,
    "photoURL" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Studios Table
CREATE TABLE IF NOT EXISTS public.studios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    "ownerId" TEXT NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Scenes Table
CREATE TABLE IF NOT EXISTS public.scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "studioId" UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Scene Items Table
CREATE TABLE IF NOT EXISTS public."sceneItems" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sceneId" UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    visible BOOLEAN DEFAULT true,
    locked BOOLEAN DEFAULT false,
    url TEXT,
    volume NUMERIC DEFAULT 0.8,
    "isMuted" BOOLEAN DEFAULT false,
    x INTEGER DEFAULT 0,
    y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 400,
    height INTEGER DEFAULT 300,
    filters JSONB DEFAULT '{"brightness": 100, "contrast": 100, "saturation": 100, "chromaKey": {"enabled": false, "color": "#00ff00", "similarity": 30, "smoothness": 10}}'::jsonb,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Recordings Table
CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "studioId" UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'podcast',
    "startTime" TIMESTAMPTZ DEFAULT NOW(),
    "endTime" TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'recording',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Recording Chunks Table
CREATE TABLE IF NOT EXISTS public.recording_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "recordingId" UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
    "chunkIndex" INTEGER NOT NULL,
    url TEXT NOT NULL,
    size BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.studios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE public."sceneItems";
ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recording_chunks;
```
