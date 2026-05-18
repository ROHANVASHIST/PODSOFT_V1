# Frontend Implementations

This monorepo contains two distinct frontends: a Web Studio (`apps/web`) and a Mobile App (`apps/mobile`). Both frontends consume the `@podsoft/shared` workspace package.

## Web Studio (`apps/web`)

The Web Studio acts as the broadcast center, managing scenes, controlling remote cameras, and receiving WebRTC video streams.

### File Structure Overview
```text
apps/web/
├── src/
│   ├── components/       # UI Components (DriveView, SupabaseProvider)
│   ├── lib/              # Utilities (Supabase client, drive auth)
│   ├── App.tsx           # Main application logic and WebRTC consumer
│   ├── main.tsx          # React 19 root entry
│   └── index.css         # Tailwind v4 entry
├── vite.config.ts        # Vite configuration (Proxy setup)
└── package.json          # Web dependencies
```

### Core Concepts
- **Vite Proxy:** Local development uses `vite.config.ts` to proxy requests starting with `/api` or `/socket.io` to the API server running on port `3001`. This simulates a same-origin production environment.
- **WebRTC Consumer:** `App.tsx` handles incoming Socket.io signals (`offer`, `ice-candidate`) from the mobile app and creates an `RTCPeerConnection` to receive the video stream.

### Shared Package Usage
```tsx
import { io, SOCKET_EVENTS, type Socket } from '@podsoft/shared';

// Utilizing shared constants for strict typing
socketRef.current?.emit(SOCKET_EVENTS.JOIN_ROOM, studioId);
socketRef.current.on(SOCKET_EVENTS.SIGNAL, async (data) => { ... });
```

---

## Mobile App (`apps/mobile`)

The Mobile App acts as a smart camera (Producer), capturing hardware video and transmitting it via WebRTC to the Web Studio.

### File Structure Overview
```text
apps/mobile/
├── app/                  # Expo Router entry points
├── src/
│   ├── engines/          # Core Logic (streaming, control, camera)
│   ├── services/         # Network (socket-service.ts, webrtc-service.ts)
│   └── state/            # Zustand stores
├── app.json              # Expo configuration & permissions
├── metro.config.js       # Minimal Metro config
└── tsconfig.json         # TS configuration with monorepo paths
```

### Core Concepts
- **React Native Vision Camera:** Captures high-performance native camera frames.
- **WebRTC Producer:** `webrtc-service.ts` initializes the `RTCPeerConnection`, creates an `offer`, and sends it to the Web Studio via Socket.io.
- **Engines & State:** Logic is decoupled into "Engines" (React hooks handling business logic) and "Stores" (Zustand state).

### Shared Package Resolution
The mobile `tsconfig.json` uses `paths` to resolve the shared package directly to its TypeScript source, avoiding the need for a separate build step:
```json
"paths": {
  "@podsoft/shared": ["../../packages/shared/src/index.ts"]
}
```
