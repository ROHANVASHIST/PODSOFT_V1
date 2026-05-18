# Environment Configuration

This document outlines the required environment variables for the different applications within the monorepo.

## Backend Variables (`apps/api/.env`)

The Node.js backend requires the following configuration to enable its services.

| Variable Name | Required | Description | Example |
|:---|:---|:---|:---|
| `PORT` | No | The port the Express server will listen on. Defaults to 3001. | `3001` |
| `GEMINI_API_KEY` | Yes | Google GenAI API key used for scene analysis and script generation features. | `AIzaSy...` |

**Security Note:** The `GEMINI_API_KEY` must never be exposed to the client side. Ensure `.env` is excluded from version control (handled in root `.gitignore`).

---

## Frontend Variables (`apps/web/.env`)

The Web Studio requires access to Supabase for authentication and scene data synchronization.

| Variable Name | Required | Description | Example |
|:---|:---|:---|:---|
| `VITE_SUPABASE_URL` | Yes | The URL for your Supabase project instance. | `https://your-project-id.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | The anonymous public key for Supabase client-side requests. | `eyJhbGci...` |

**Security Note:** Variables prefixed with `VITE_` are injected into the client bundle at build time. Do not place secret keys (like service role keys) in this file.

---

## Mobile Variables

Currently, the mobile application does not require a local `.env` file, as the signaling server URL is configured internally and Supabase/EAS configuration is handled via Expo config (`app.json` / `eas.json`).
