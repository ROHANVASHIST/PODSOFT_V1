# App Usage Guide

## 1. Running the Main Application Dashboard
The main application acts as the control center and viewer for all streams.
- **Start command**: `npm run dev`
- **Access**: Navigate to the provided dev URL.

## 2. Using the Mobile Camera Streamer (DroidCam)
To connect a mobile device as a camera source, you can use the built-in mobile streamer.
- **Access**: Add `?mode=mobile` to the main application URL on your mobile device (e.g., `https://<your-app-url>?mode=mobile`).
- **Functionality**:
    1.  On the mobile device, navigate to the URL with the `?mode=mobile` query parameter.
    2.  Grant the browser permission to access your camera and microphone.
    3.  The device will automatically initialize the WebRTC stream and signal the main application to pair via the socket server.
    4.  The feed will appear in the main application's interface.

## 3. Configuration
- Ensure your environment variables are set correctly in `.env` (refer to `.env.example`).
