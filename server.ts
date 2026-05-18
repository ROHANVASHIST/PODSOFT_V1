import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import axios from "axios";
import os from "os";
import { SOCKET_EVENTS } from "./src/lib/shared/socket-events";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*" }
  });
  const PORT = 3000;

  app.use(express.json());

  // Socket.io signaling
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload) => {
      const roomId = typeof payload === 'string' ? payload : payload.roomId;
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.role = typeof payload !== 'string' ? payload.role : 'unknown';
      console.log(`Socket ${socket.id} joined room ${roomId} as ${socket.data.role}`);
      
      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients && clients.size === 2) {
        io.to(roomId).emit(SOCKET_EVENTS.PAIRED, { roomId });
        console.log(`PAIRED emitted for room ${roomId}`);
      }
    });

    socket.on(SOCKET_EVENTS.SIGNAL, (data) => {
      io.to(data.roomId).emit(SOCKET_EVENTS.SIGNAL, {
        senderId: socket.id,
        ...data
      });
    });

    socket.on(SOCKET_EVENTS.COMMAND, (data) => {
      io.to(data.roomId).emit(SOCKET_EVENTS.COMMAND, {
        senderId: socket.id,
        ...data
      });
    });
  });

  // Gemini API Initialization
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // ... (rest of the routes are the same)

  // Session Management API
  app.post("/api/v1/sessions", (req, res) => {
    // TODO: Create session in Firestore
    const { name, mode } = req.body;
    res.json({ id: "session_" + Date.now(), name, mode, status: "prep" });
  });

  app.get("/api/v1/sessions/:id", (req, res) => {
    // TODO: Get session from Firestore
    res.json({ id: req.params.id, status: "prep" });
  });

  // Processing/Jobs API
  app.post("/api/v1/sessions/:id/process", (req, res) => {
    // TODO: Enqueue processing job
    res.json({ jobId: "job_" + Date.now(), status: "queued" });
  });

  app.get("/api/v1/jobs/:id", (req, res) => {
    // TODO: Get job status
    res.json({ id: req.params.id, status: "processing", progress: 50 });
  });

  // Network detection endpoint to get local network IP addresses
  app.get("/api/networks", (req, res) => {
    const interfaces = os.networkInterfaces();
    const addresses: { name: string; address: string }[] = [];
    
    for (const name in interfaces) {
      const iface = interfaces[name];
      if (!iface) continue;
      
      for (const entry of iface) {
        if (entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254")) {
          addresses.push({
            name,
            address: entry.address
          });
        }
      }
    }
    
    res.json({ addresses });
  });

  // Proxy route for DroidCam/CORS bypass
  app.get("/api/proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Inform about local/private IPs in cloud environment
    if (process.env.NODE_ENV === "production" || process.env.K_SERVICE) {
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;
        const isLocal = (host: string) => {
          if (host === 'localhost' || host === '127.0.0.1') return true;
          const parts = host.split('.').map(Number);
          if (parts.length !== 4) return false;
          return (parts[0] === 10) || 
                 (parts[0] === 192 && parts[1] === 168) || 
                 (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
                 (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
        };

        if (isLocal(hostname)) {
          console.warn(`Proxy requested for local IP ${hostname}. Cloud servers cannot reach private networks. Attempting anyway...`);
        }
      } catch (e) {}
    }

    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        timeout: 30000 // Increased to 30s for slow connections or high-res MJPEG handshakes
      });

      const contentType = response.headers['content-type'] as string;
      if (contentType) res.setHeader("Content-Type", contentType);
      
      response.data.pipe(res);
    } catch (error: any) {
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout');
      const isNetworkError = error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH';
      
      console.error(`Proxy Error [${url}]:`, error.message, error.code);
      
      if (isTimeout) {
        res.status(504).json({ 
          error: "Connection Timed Out", 
          details: `The request to ${url} timed out (30s). Private network IPs (192.168.x.x, 10.x.x.x, 172.16.x.x, or 100.x.x.x) are NOT accessible from this cloud environment. Use a public URL (e.g., Ngrok or LocalTunnel).`,
          code: "TIMEOUT"
        });
      } else if (isNetworkError) {
        res.status(502).json({ 
          error: "Source Unreachable", 
          details: `Could not reach ${url}. Ensure the DroidCam app is open and the IP/Port is correct. Private/Local IPs only work if you are running this app locally.`,
          code: "UNREACHABLE"
        });
      } else {
        res.status(500).json({ 
          error: "Proxy Failed", 
          details: error.message, 
          code: error.code || "UNKNOWN" 
        });
      }
    }
  });

  // Example Gemini proxy route
  app.post("/api/analyze-scene", async (req, res) => {
    try {
      const { sceneDescription } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As an expert OBS Studio advisor, analyze this scene setup and suggest professional improvements: ${sceneDescription}`
      });
      
      res.json({ advice: response.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to analyze scene" });
    }
  });

  app.post("/api/analyze-composition", async (req, res) => {
    try {
      const { sources } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a professional video editor. Analyze this source list for a video broadcast and suggest the optimal z-order, scaling, and position for each to create a high-production look. Sources: ${JSON.stringify(sources)}. Provide concise, actionable layout tips.`
      });
      
      res.json({ advice: response.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to analyze composition" });
    }
  });

  app.post("/api/summarize-recording", async (req, res) => {
    try {
      const { name, metadata } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a catchy social media title and 3 bullet point highlights for a recording named "${name}" with the following metadata: ${JSON.stringify(metadata)}`
      });
      
      res.json({ summary: response.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to summarize recording" });
    }
  });

  app.post("/api/generate-script", async (req, res) => {
    try {
      const { sceneName, sources } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a professional 2-minute introductory script for a live stream titled "${sceneName}". The scene includes these sources: ${JSON.stringify(sources)}. Make it energetic and suitable for a professional podcast production.`
      });
      
      res.json({ script: response.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to generate script" });
    }
  });

  app.post("/api/generate-layout-specs", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              sceneName: { type: "string" },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["camera", "image", "browser", "screen"] },
                    x: { type: "number" },
                    y: { type: "number" },
                    width: { type: "number" },
                    height: { type: "number" }
                  },
                  required: ["name", "type", "x", "y", "width", "height"]
                }
              }
            },
            required: ["sceneName", "sources"]
          }
        },
        contents: `Generate a JSON layout for an OBS-style scene based on this prompt: "${prompt}". 
        Coordinates: x/y from 0 to 1920 (x) and 0 to 1080 (y). 
        Width/Height: standard pixels. 
        Types: camera, image, browser, screen.`
      });
      
      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to generate layout specs" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`PodSoft running at http://localhost:${PORT}`);
  });

  // Upload endpoint for recording chunks
  app.post("/api/upload-chunk", express.raw({ type: 'video/webm', limit: '50mb' }), (req, res) => {
    const { recordingId, index } = req.query;
    console.log(`Received chunk ${index} for recording ${recordingId}. Size: ${req.body.length} bytes`);
    res.json({ success: true, url: `/api/recordings/${recordingId}/${index}.webm` });
  });
}

startServer();
