-- Supabase Database Schema for PODSOFT_V1 (Migrated from Firebase)

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
