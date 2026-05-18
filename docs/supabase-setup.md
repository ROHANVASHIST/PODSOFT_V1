# Supabase Setup Guide

Run these steps **once** in your Supabase project before starting the API server.

---

## About API Keys

Supabase has two tiers of keys — you need both:

| Key | Used by | Purpose |
|---|---|---|
| **Publishable** (`sb_publishable_xxx`) | Browser / web app | Safe to expose. Respects RLS. |
| **Secret** (`sb_secret_xxx`) | API server only | Bypasses RLS. Never expose to browser. |

> **Note on `service_role`:** The old `service_role` JWT key is the legacy equivalent of the new secret key. It still works and won't be removed until late 2026. The new `sb_secret_xxx` key is preferred — it's rotatable without touching your JWT secret. Both work identically for server-side Storage uploads. Use whichever your project has.

---

## 1 — Create the Storage Bucket

1. Open your Supabase project → **Storage** → **New bucket**
2. Name: `recordings`
3. Public: **OFF** (private — access via signed URLs only)
4. File size limit: `500 MB` (increase if you expect long sessions)
5. Allowed MIME types: `video/webm`
6. Click **Save**

---

## 2 — Storage RLS Policies

The API server uses a secret key which bypasses RLS entirely, so no Storage policies are strictly required for the upload/finalize flow. However, add this policy so authenticated users can verify their own signed URLs are valid:

Run in **SQL Editor** → **New query**:

```sql
-- Authenticated users can read their own recordings via signed URL.
-- The API server generates signed URLs server-side using the secret key,
-- so this policy is a safety net — not the primary access path.
CREATE POLICY "Authenticated read own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.recordings
    WHERE "studioId" IN (
      SELECT id FROM public.studios
      WHERE "ownerId" = auth.uid()::text
    )
  )
);
```

---

## 3 — Add `finalUrl` Column to `recordings` Table

Run in **SQL Editor** → **New query**:

```sql
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS "finalUrl" text;
```

---

## 4 — Get Your Secret Key

Go to **Supabase dashboard → Project Settings → API Keys**.

You'll see two tabs:

- **API Keys** — the new `sb_publishable_xxx` and `sb_secret_xxx` keys *(use these)*
- **Legacy anon, service_role API keys** — the old JWT-based keys *(still work, but prefer the new ones)*

Copy the **secret key** (`sb_secret_xxx`) from the first tab. If your project was created before late 2024 and only shows the legacy tab, copy the `service_role` key instead — it works identically.

Add both to `apps/api/.env`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ This key bypasses RLS and has full access to your project. Never put it in browser code, never commit it to git. The `.env` file is already in `.gitignore`.

The web app (`apps/web`) uses the **publishable key** — that's already in `apps/web/.env` as `VITE_SUPABASE_PUBLISHABLE_KEY`. No change needed there.

---

## 5 — Verify

After running the SQL and updating `apps/api/.env`, restart the API server:

```bash
npm run dev:api
```

Start a recording in the studio, then stop it. You should see:

- Chunks appearing in **Storage → recordings → {recordingId}/** in the Supabase dashboard
- A `final.webm` file appearing after you stop recording
- The `recordings` table row updated with a `finalUrl`
- A download starting automatically in the browser
