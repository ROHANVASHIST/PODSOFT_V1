# Backend API Implementation

The backend (`apps/api`) serves two primary functions:
1. **WebRTC Signaling Relay:** Facilitating the handshake between the Mobile App and the Web Studio.
2. **AI & Utility Services:** Providing endpoints for AI scene analysis, script generation, and proxying HTTP video streams.

## File Structure Overview
```text
apps/api/
├── server.ts         # Main Express & Socket.io entry point
├── package.json      # API dependencies
├── tsconfig.json     # Node-specific TS config
└── .env              # Secrets
```

## Socket.io Signaling

The backend acts as a dumb relay for WebRTC signaling. It places connecting clients into "Rooms" and broadcasts signals (`offer`, `answer`, `ice-candidate`) to other participants in that room.

### Event Handling
The server imports the strict contract from `@podsoft/shared`:

```typescript
import { Server } from "socket.io";
import { SOCKET_EVENTS } from '@podsoft/shared';

io.on("connection", (socket) => {
  // Join a specific studio room
  socket.on(SOCKET_EVENTS.JOIN_ROOM, (roomId) => {
    socket.join(roomId);
  });

  // Relay signals to everyone else in the room
  socket.on(SOCKET_EVENTS.SIGNAL, (data) => {
    io.to(data.roomId).emit(SOCKET_EVENTS.SIGNAL, {
      senderId: socket.id,
      ...data
    });
  });
  
  // Relay remote commands (e.g., Toggle Flashlight)
  socket.on(SOCKET_EVENTS.COMMAND, (data) => {
    io.to(data.roomId).emit(SOCKET_EVENTS.COMMAND, {
      senderId: socket.id,
      ...data
    });
  });
});
```

## Proxy Route (`/api/proxy`)

Because cloud-hosted web applications (HTTPS) are blocked by modern browsers from accessing local network IPs directly (Mixed Content & Private Network Access restrictions), the API provides a fallback proxy.

The `/api/proxy` endpoint streams external video sources (like DroidCam MJPEG feeds) through the backend to bypass browser security policies in the Web Studio.
