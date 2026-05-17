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

-- Enable Realtime for all tables safely (idempotent)
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['users', 'studios', 'scenes', 'sceneItems', 'recordings', 'recording_chunks'];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
        END IF;
    END LOOP;
END;
$$;

-- ==========================================
-- ROW LEVEL SECURITY (RLS) CONFIGURATION
-- ==========================================

-- 1. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sceneItems" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_chunks ENABLE ROW LEVEL SECURITY;

-- 2. Create permissive policies for authenticated users
-- Users Table
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow user insert self" ON public.users;
CREATE POLICY "Allow user insert self" ON public.users FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow user update self" ON public.users;
CREATE POLICY "Allow user update self" ON public.users FOR UPDATE USING (auth.role() = 'authenticated');

-- Studios Table
DROP POLICY IF EXISTS "Allow public read studios" ON public.studios;
CREATE POLICY "Allow public read studios" ON public.studios FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert studios" ON public.studios;
CREATE POLICY "Allow authenticated insert studios" ON public.studios FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update studios" ON public.studios;
CREATE POLICY "Allow authenticated update studios" ON public.studios FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete studios" ON public.studios;
CREATE POLICY "Allow authenticated delete studios" ON public.studios FOR DELETE USING (auth.role() = 'authenticated');

-- Scenes Table
DROP POLICY IF EXISTS "Allow public read scenes" ON public.scenes;
CREATE POLICY "Allow public read scenes" ON public.scenes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert scenes" ON public.scenes;
CREATE POLICY "Allow authenticated insert scenes" ON public.scenes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update scenes" ON public.scenes;
CREATE POLICY "Allow authenticated update scenes" ON public.scenes FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete scenes" ON public.scenes;
CREATE POLICY "Allow authenticated delete scenes" ON public.scenes FOR DELETE USING (auth.role() = 'authenticated');

-- SceneItems Table
DROP POLICY IF EXISTS "Allow public read sceneItems" ON public."sceneItems";
CREATE POLICY "Allow public read sceneItems" ON public."sceneItems" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert sceneItems" ON public."sceneItems";
CREATE POLICY "Allow authenticated insert sceneItems" ON public."sceneItems" FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update sceneItems" ON public."sceneItems";
CREATE POLICY "Allow authenticated update sceneItems" ON public."sceneItems" FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete sceneItems" ON public."sceneItems";
CREATE POLICY "Allow authenticated delete sceneItems" ON public."sceneItems" FOR DELETE USING (auth.role() = 'authenticated');

-- Recordings Table
DROP POLICY IF EXISTS "Allow public read recordings" ON public.recordings;
CREATE POLICY "Allow public read recordings" ON public.recordings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert recordings" ON public.recordings;
CREATE POLICY "Allow authenticated insert recordings" ON public.recordings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update recordings" ON public.recordings;
CREATE POLICY "Allow authenticated update recordings" ON public.recordings FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete recordings" ON public.recordings;
CREATE POLICY "Allow authenticated delete recordings" ON public.recordings FOR DELETE USING (auth.role() = 'authenticated');

-- Recording Chunks Table
DROP POLICY IF EXISTS "Allow public read recording_chunks" ON public.recording_chunks;
CREATE POLICY "Allow public read recording_chunks" ON public.recording_chunks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert recording_chunks" ON public.recording_chunks;
CREATE POLICY "Allow authenticated insert recording_chunks" ON public.recording_chunks FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update recording_chunks" ON public.recording_chunks;
CREATE POLICY "Allow authenticated update recording_chunks" ON public.recording_chunks FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete recording_chunks" ON public.recording_chunks;
CREATE POLICY "Allow authenticated delete recording_chunks" ON public.recording_chunks FOR DELETE USING (auth.role() = 'authenticated');
