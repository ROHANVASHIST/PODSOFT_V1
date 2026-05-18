# Architecture & System Design

## High-Level Architecture

The PodSoft monorepo is structured to separate concerns while sharing a strict contract for real-time communication.

```text
podsoft-monorepo/
├── apps/
│   ├── api/            (Node.js Express + Socket.io Server)
│   ├── web/            (React/Vite Web Studio)
│   └── mobile/         (Expo React Native App)
└── packages/
    └── shared/         (Shared Types & Constants)
```

## Flow Diagram: WebRTC & Signaling

The core functionality of PodSoft involves real-time video streaming from the Mobile App to the Web Studio, orchestrated by the API backend.

```
+----------------+          Signaling (Socket.io)          +---------------+
|                | <-------------------------------------> |               |
|  Mobile App    |                                         |  API Server   |
|  (Producer)    |          Signaling (Socket.io)          |  (Relay)      |
|                | <-------------------------------------> |               |
+----------------+                                         +---------------+
        |                                                          ^
        |                       WebRTC (P2P)                       |
        +----------------------------------------------------------+
        |                                                          |
        v                                                          v
+----------------+          Signaling (Socket.io)          +---------------+
|                | <-------------------------------------> |               |
|  Web Studio    |                                         |  Web Studio   |
|  (Consumer)    |                                         |  (Consumer)   |
|                |                                         |               |
+----------------+                                         +---------------+
```
*(Note: Web Studio connects to API for signaling, and WebRTC establishes P2P media streaming directly between Mobile and Web)*

## Key Design Decisions

### 1. Turborepo + NPM Workspaces
**Why?** To solve dependency fragmentation. Previously, the web and mobile apps easily drifted out of sync regarding React versions and socket payload types. NPM workspaces hoist dependencies (ensuring exactly one version of `react@19.1.0` is used), and Turborepo orchestrates parallel `dev` and `build` tasks efficiently.

### 2. The `@podsoft/shared` Package
**Why?** To create a single source of truth for the Socket.io contract.
- It exports `SOCKET_EVENTS` constants, preventing string typos in event listeners.
- It defines `SignalPayload`, `CommandPayload`, and other TypeScript interfaces.
- It re-exports `io` and `Socket` from `socket.io-client`, ensuring both the Web and Mobile apps use the exact same client library version.

### 3. Strict React 19 Versioning
**Why?** React 19 introduces strict rules, and having multiple versions of React across a monorepo leads to the dreaded "Invalid Hook Call" error. The root `package.json` uses `overrides` to pin `react` and `react-dom` to `19.1.0` globally.

### 4. Expo SDK 54 Monorepo Support
**Why?** Expo SDK 54 introduced native support for monorepos without requiring complex `metro.config.js` overrides to resolve workspace packages. The setup relies on this modern default behavior.

## Security Boundaries
- **CORS/Proxy:** The web studio uses a Vite proxy (`/api` and `/socket.io`) to route requests to the backend, avoiding CORS issues during local development.
- **Local Network Streaming:** Browsers block cloud-hosted HTTPS sites from accessing local HTTP IPs (e.g., DroidCam). The monorepo handles this via an API proxy fallback or direct P2P WebRTC tunnels.
