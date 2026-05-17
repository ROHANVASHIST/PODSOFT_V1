# PodSoft Studio

Professional-grade web-based video production and streaming studio, inspired by OBS Studio.

## 🚀 Key Features

- **Multi-Scene Management**: Create, switch, and manage multiple scenes like `Main Scene`, `BRB`, etc.
- **Advanced Source Support**: 
    - **Camera/Webcam**: Direct browser integration.
    - **Display Capture**: Share screens or windows.
    - **DroidCam Client**: Connect your phone via IP/Port (MJPEG stream).
    - **Image/Text**: Basic overlays.
- **Studio Mode**: Dual-pane Preview and Program views with transition logic.
- **Audio Mixer**: Real-time visual feedback for audio levels.
- **Filters & Effects**: Real-time Brightness and Contrast controls.
- **Local Recording**: Record your output directly to `.webm` using the browser's MediaRecorder API.
- **AI Scene Analysis**: Integrated Gemini AI to analyze your setup and provide professional streaming advice.

## 🛠 Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Motion, Lucide Icons.
- **Backend**: Express (Vite Middleware) for API proxying and AI integration.
- **AI**: Google Gemini API for professional scene analysis.
- **Standards**: WebRTC, MediaDevices API, MediaRecorder API.

## 📁 Repository Structure

- `src/App.tsx`: Main application logic and UI.
- `server.ts`: Express server with Gemini AI integration.
- `prd.md`: Product Requirements Document.
- `follow.md`: Build roadmap and implementation status.
- `copy.md`: OBS Studio source-parity mapping.

## 🚦 How to Connect DroidCam

1. Launch DroidCam on your phone.
2. In PodSoft, click `+` in the **Sources** dock.
3. Select **DroidCam**.
4. Enter the IP and Port shown on your phone.
5. Click **Connect**.

---
*Developed for Antigravity AI Studio*
