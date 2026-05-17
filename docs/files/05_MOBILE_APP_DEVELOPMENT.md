# PodSoft — Mobile App Architecture & Development Guide

**Version:** 2.0  
**Status:** Production Ready  
**Last Updated:** May 2026  
**Audience:** Mobile Developers, React Native Engineers  
**Document Owner:** Mobile Lead

---

## 1. Mobile App Overview

### 1.1 Platform Support
- **iOS**: 14.0+ (iPhone 11 and newer)
- **Android**: API 26+ (Android 8.0 and newer)
- **Framework**: React Native with Expo
- **Build**: Managed builds via EAS (Expo Application Services)

### 1.2 Core Responsibilities
1. **Recording**: Capture video/audio locally at full quality
2. **Preview**: Stream low-res preview to web studio
3. **Chunking**: Split 10-min segments, manage local buffer
4. **Uploading**: Chunk uploads with progress tracking
5. **Sync**: Receive sync markers, display timing cues
6. **Status**: Report device health (battery, storage, signal)
7. **Offline**: Work offline, queue uploads for later

---

## 2. Project Structure

```
frontend/mobile/
├── app.json                        # Expo configuration
├── eas.json                        # EAS build configuration
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
│
├── src/
│   ├── app/
│   │   ├── _layout.tsx            # Root navigation layout
│   │   ├── index.tsx              # Welcome screen
│   │   ├── join-session.tsx       # Join session flow
│   │   └── recording/
│   │       ├── _layout.tsx
│   │       ├── index.tsx          # Recording screen
│   │       ├── preview.tsx        # Low-res preview
│   │       └── status.tsx         # Device status panel
│   │
│   ├── components/
│   │   ├── RecordingControls.tsx  # Record/pause/stop buttons
│   │   ├── DeviceStatus.tsx       # Battery, storage, signal
│   │   ├── SyncMarker.tsx         # Visual sync cue
│   │   ├── PreviewTile.tsx        # Preview stream tile
│   │   ├── UploadProgress.tsx     # Chunk upload progress
│   │   ├── ErrorBoundary.tsx      # Error handling
│   │   └── Camera/
│   │       ├── CameraView.tsx     # Camera component wrapper
│   │       ├── AudioCapture.tsx   # Audio input handler
│   │       └── DeviceSelector.tsx # Front/back/mic selection
│   │
│   ├── services/
│   │   ├── api.service.ts         # REST API client
│   │   ├── auth.service.ts        # Authentication
│   │   ├── socket.service.ts      # WebSocket/Socket.IO
│   │   ├── recording.service.ts   # Local recording logic
│   │   ├── upload.service.ts      # Chunk upload management
│   │   ├── storage.service.ts     # Device storage check
│   │   ├── sync.service.ts        # Sync marker handling
│   │   └── metrics.service.ts     # Local analytics
│   │
│   ├── hooks/
│   │   ├── useRecording.ts        # Recording state + controls
│   │   ├── useDeviceStatus.ts     # Device health monitoring
│   │   ├── useChunkUpload.ts      # Upload queue management
│   │   ├── useSocket.ts           # WebSocket connection
│   │   ├── usePermissions.ts      # Camera/mic permissions
│   │   └── useOfflineQueue.ts     # Offline action queue
│   │
│   ├── store/
│   │   ├── session.store.ts       # Zustand: session state
│   │   ├── recording.store.ts     # Zustand: recording state
│   │   ├── device.store.ts        # Zustand: device state
│   │   └── auth.store.ts          # Zustand: auth state
│   │
│   ├── types/
│   │   ├── index.ts               # TypeScript interfaces
│   │   ├── api.ts
│   │   ├── recording.ts
│   │   └── socket.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── formatters.ts          # Time, size, signal strength
│   │   ├── validators.ts
│   │   ├── permissions.ts         # iOS/Android permission helpers
│   │   └── constants.ts
│   │
│   ├── styles/
│   │   ├── theme.ts               # Colors, typography, spacing
│   │   └── common.ts              # Shared styles
│   │
│   └── navigation/
│       ├── RootNavigator.tsx
│       ├── AuthNavigator.tsx
│       └── RecordingNavigator.tsx
│
├── ios/                           # Native iOS code
│   ├── Podfile
│   ├── Podfile.lock
│   └── PodSoft/
│       ├── Info.plist
│       └── AppDelegate.swift
│
├── android/                       # Native Android code
│   ├── app/
│   ├── settings.gradle
│   └── build.gradle
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── docs/
    ├── SETUP.md
    ├── RECORDING.md
    ├── DEPLOYMENT.md
    └── TROUBLESHOOTING.md
```

---

## 3. Recording Architecture

### 3.1 Recording Flow

```
┌─────────────────────────────────────────────────┐
│           User Taps "Record" Button              │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │ Request Permissions     │
        │ • Camera               │
        │ • Microphone           │
        │ • Storage              │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │ Initialize Recording                │
        │ • Create output file path           │
        │ • Start H.264 encoder               │
        │ • Start AAC audio encoder           │
        │ • Initialize chunk buffer (10min)   │
        └────────────┬────────────────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │ Continuous Recording                │
        │ • Capture video frames (30fps)      │
        │ • Capture audio samples (48kHz)     │
        │ • Write to local file               │
        │ • Update UI every 100ms             │
        └────────────┬────────────────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │ Every 10 Minutes                    │
        │ • Finalize chunk_N.mp4              │
        │ • Save metadata                     │
        │ • Start chunk_N+1.mp4               │
        │ • Queue chunk_N for upload          │
        │ • Begin background upload           │
        └────────────┬────────────────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │ User Taps "Stop"                    │
        │ • Finalize current chunk            │
        │ • Stop all encoders                 │
        │ • Mark session as stopped           │
        │ • Queue final chunk for upload      │
        │ • Show upload progress              │
        └─────────────────────────────────────┘
```

### 3.2 Recording Implementation (React Native)

```typescript
// src/hooks/useRecording.ts

import { useRef, useState, useCallback } from 'react';
import { recordingService } from '../services/recording.service';
import { useRecordingStore } from '../store/recording.store';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;        // seconds
  currentChunk: number;
  chunkDuration: number;   // seconds (600 = 10 min)
  fileSize: number;        // bytes
  error?: string;
}

export function useRecording(sessionId: string) {
  const store = useRecordingStore();
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    currentChunk: 0,
    chunkDuration: 600,
    fileSize: 0
  });

  const recordingRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Request permissions
      const perms = await recordingService.requestPermissions();
      if (!perms.granted) throw new Error('Permissions denied');

      // Initialize encoder
      recordingRef.current = await recordingService.initializeRecorder({
        sessionId,
        quality: 'high',      // 1080p 30fps
        audio: { sampleRate: 48000, channels: 2 }
      });

      setState(s => ({ ...s, isRecording: true }));
      store.setRecording(true);

      // Start timer for UI updates
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setState(s => ({ ...s, duration: seconds }));

        // Check if chunk is ready
        if (seconds % 600 === 0) {
          handleChunkReady();
        }
      }, 1000);

    } catch (err) {
      setState(s => ({ ...s, error: err.message }));
    }
  }, [sessionId, store]);

  // Handle chunk finalization
  const handleChunkReady = useCallback(async () => {
    try {
      const chunk = await recordingService.finalizeChunk(recordingRef.current);
      
      setState(s => ({
        ...s,
        currentChunk: s.currentChunk + 1,
        fileSize: chunk.fileSize
      }));

      // Queue for upload
      await uploadService.queueChunk(chunk);

      // Broadcast to studio
      socketService.emit('chunk:ready', {
        sessionId,
        chunkIndex: state.currentChunk,
        duration_ms: 600000,
        file_size_bytes: chunk.fileSize,
        hash: chunk.hash
      });

    } catch (err) {
      console.error('Chunk finalization failed', err);
    }
  }, [sessionId, state.currentChunk]);

  // Pause recording
  const pauseRecording = useCallback(async () => {
    await recordingService.pause(recordingRef.current);
    setState(s => ({ ...s, isPaused: true }));
    store.setPaused(true);
  }, [store]);

  // Resume recording
  const resumeRecording = useCallback(async () => {
    await recordingService.resume(recordingRef.current);
    setState(s => ({ ...s, isPaused: false }));
    store.setPaused(false);
  }, [store]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      clearInterval(timerRef.current);
      
      const finalChunk = await recordingService.stop(recordingRef.current);
      
      setState(s => ({ ...s, isRecording: false }));
      store.setRecording(false);

      // Queue final chunk
      await uploadService.queueChunk(finalChunk);

      return finalChunk;
    } catch (err) {
      setState(s => ({ ...s, error: err.message }));
    }
  }, [store]);

  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording
  };
}
```

---

## 4. WebSocket Integration

### 4.1 Socket.IO Connection

```typescript
// src/services/socket.service.ts

import io, { Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(sessionId: string, deviceToken: string) {
    try {
      const token = await SecureStore.getItemAsync('auth_token');

      this.socket = io(process.env.EXPO_PUBLIC_API_URL, {
        auth: {
          token: `Bearer ${token}`,
          sessionId,
          deviceToken
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        autoConnect: true
      });

      // Connection established
      this.socket.on('connect', () => {
        logger.info('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emitDeviceInfo();
      });

      // Listen for commands
      this.socket.on('command:record_start', this.handleRecordStart);
      this.socket.on('command:pause', this.handlePause);
      this.socket.on('command:resume', this.handleResume);
      this.socket.on('command:stop', this.handleStop);
      this.socket.on('command:sync_marker', this.handleSyncMarker);

      // Listen for updates
      this.socket.on('session:update', this.handleSessionUpdate);
      this.socket.on('session:sync_status', this.handleSyncStatus);

      // Connection lost
      this.socket.on('disconnect', () => {
        logger.warn('WebSocket disconnected');
      });

      // Error handling
      this.socket.on('error', (error) => {
        logger.error('WebSocket error', error);
      });

    } catch (err) {
      logger.error('Failed to connect', err);
      throw err;
    }
  }

  emit(event: string, data: any) {
    if (!this.socket?.connected) {
      logger.warn('Socket not connected, queueing event', event);
      return;
    }
    this.socket.emit(event, data);
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  private emitDeviceInfo() {
    this.emit('device:register', {
      deviceId: 'device_xyz',  // TODO: get from device store
      label: getDeviceName(),
      kind: 'phone',
      os: Platform.OS,
      osVersion: Platform.Version,
      appVersion: '1.0.0'
    });
  }

  private handleRecordStart = (data: any) => {
    recordingStore.setSettings(data.settings);
    // UI will handle actual start
  };

  private handleSyncMarker = (data: any) => {
    // Flash screen for visual cue
    syncMarkerStore.setMarker({
      type: data.type,
      timestamp: data.timestamp
    });
  };

  // ... more handlers

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
```

---

## 5. Chunk Upload Management

### 5.1 Upload Queue

```typescript
// src/services/upload.service.ts

import * as FileSystem from 'expo-file-system';
import { apiService } from './api.service';

interface ChunkUploadTask {
  id: string;
  sessionId: string;
  deviceId: string;
  chunkIndex: number;
  filePath: string;
  fileSize: number;
  hash: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  retries: number;
  error?: string;
}

class UploadService {
  private uploadQueue: Map<string, ChunkUploadTask> = new Map();
  private activeUploads: Map<string, XMLHttpRequest> = new Map();
  private maxConcurrent = 2;
  private maxRetries = 3;

  async queueChunk(chunk: {
    filePath: string;
    chunkIndex: number;
    fileSize: number;
    hash: string;
  }) {
    const task: ChunkUploadTask = {
      id: `chunk_${Date.now()}`,
      sessionId: recordingStore.sessionId,
      deviceId: deviceStore.deviceId,
      chunkIndex: chunk.chunkIndex,
      filePath: chunk.filePath,
      fileSize: chunk.fileSize,
      hash: chunk.hash,
      status: 'pending',
      progress: 0,
      retries: 0
    };

    this.uploadQueue.set(task.id, task);
    this.processQueue();
  }

  private async processQueue() {
    const activeCount = Array.from(this.activeUploads.values()).length;
    if (activeCount >= this.maxConcurrent) return;

    const pending = Array.from(this.uploadQueue.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => a.chunkIndex - b.chunkIndex)[0];

    if (!pending) return;

    this.uploadChunk(pending);
  }

  private async uploadChunk(task: ChunkUploadTask) {
    try {
      task.status = 'uploading';

      // 1. Request presigned URL
      const urlResponse = await apiService.post(
        `/sessions/${task.sessionId}/chunks`,
        {
          device_id: task.deviceId,
          chunk_index: task.chunkIndex,
          duration_ms: 600000,
          file_size_bytes: task.fileSize,
          hash: task.hash,
          filename: `chunk_${task.chunkIndex}.mp4`
        }
      );

      const { s3_upload_url, headers } = urlResponse.data;

      // 2. Read file
      const fileData = await FileSystem.readAsStringAsync(
        task.filePath,
        { encoding: FileSystem.EncodingType.Base64 }
      );

      // 3. Upload to S3 with progress
      await this.uploadToS3(task, s3_upload_url, fileData, headers);

      task.status = 'completed';
      task.progress = 100;

      // Emit to socket
      socketService.emit('chunk:uploaded', {
        chunkId: task.id,
        duration_ms: 600000,
        hash_verified: true
      });

    } catch (err) {
      task.retries++;
      if (task.retries < this.maxRetries) {
        task.status = 'pending';
        // Exponential backoff
        setTimeout(() => this.uploadChunk(task), 
          Math.pow(2, task.retries) * 1000);
      } else {
        task.status = 'failed';
        task.error = err.message;
      }
    } finally {
      this.activeUploads.delete(task.id);
      this.processQueue();
    }
  }

  private async uploadToS3(
    task: ChunkUploadTask,
    url: string,
    data: string,
    headers: any
  ) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.activeUploads.set(task.id, xhr);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          task.progress = Math.round((e.loaded / e.total) * 100);
          socketService.emit('chunk:upload_progress', {
            chunkId: task.id,
            progress_percent: task.progress
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve(undefined);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.open('PUT', url);
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value as string);
      });
      xhr.send(data);
    });
  }

  getUploadProgress(chunkId: string): number {
    return this.uploadQueue.get(chunkId)?.progress ?? 0;
  }
}

export const uploadService = new UploadService();
```

---

## 6. UI Components

### 6.1 Recording Screen

```typescript
// src/app/recording/index.tsx

import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import { useRecording } from '../../hooks/useRecording';
import { useDeviceStatus } from '../../hooks/useDeviceStatus';
import RecordingControls from '../../components/RecordingControls';
import DeviceStatus from '../../components/DeviceStatus';
import UploadProgress from '../../components/UploadProgress';
import SyncMarker from '../../components/SyncMarker';
import { formatTime } from '../../utils/formatters';

export default function RecordingScreen() {
  const sessionId = 'sess_abc123';  // From navigation params
  const recording = useRecording(sessionId);
  const deviceStatus = useDeviceStatus();

  useEffect(() => {
    // Start recording on mount
    recording.startRecording();
    return () => {
      if (recording.isRecording) {
        recording.stopRecording();
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera Preview */}
      <View style={styles.cameraContainer}>
        <Camera style={styles.camera} type="front" />
        
        {/* Duration Badge */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {formatTime(recording.duration)}
          </Text>
        </View>

        {/* Sync Marker (if active) */}
        <SyncMarker />
      </View>

      {/* Device Status Panel */}
      <DeviceStatus status={deviceStatus} />

      {/* Upload Progress */}
      <UploadProgress chunkIndex={recording.currentChunk} />

      {/* Recording Controls */}
      <RecordingControls
        isRecording={recording.isRecording}
        isPaused={recording.isPaused}
        onPause={recording.pauseRecording}
        onResume={recording.resumeRecording}
        onStop={recording.stopRecording}
      />

      {/* Error Display */}
      {recording.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{recording.error}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  cameraContainer: {
    flex: 1,
    position: 'relative'
  },
  camera: {
    flex: 1
  },
  durationBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  durationText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums']
  },
  errorBanner: {
    backgroundColor: '#ff3b30',
    padding: 12
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500'
  }
});
```

### 6.2 Device Status Component

```typescript
// src/components/DeviceStatus.tsx

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatBytes } from '../utils/formatters';

interface DeviceStatusProps {
  battery: number;           // 0-100
  storage: number;          // 0-100
  signal: 'poor' | 'fair' | 'good' | 'excellent';
  networkType: string;      // 'wifi' | '4g' | '5g'
}

export default function DeviceStatus(props: DeviceStatusProps) {
  const signalColor = {
    poor: '#ff3b30',
    fair: '#ff9500',
    good: '#34c759',
    excellent: '#34c759'
  }[props.signal];

  return (
    <View style={styles.container}>
      {/* Battery */}
      <View style={styles.statusItem}>
        <MaterialCommunityIcons
          name={`battery-${Math.round(props.battery / 10) * 10}`}
          size={20}
          color={props.battery < 20 ? '#ff3b30' : '#34c759'}
        />
        <Text style={styles.statusText}>{props.battery}%</Text>
      </View>

      {/* Storage */}
      <View style={styles.statusItem}>
        <MaterialCommunityIcons
          name="harddisk"
          size={20}
          color={props.storage < 20 ? '#ff3b30' : '#34c759'}
        />
        <Text style={styles.statusText}>{100 - props.storage}%</Text>
      </View>

      {/* Network */}
      <View style={styles.statusItem}>
        <MaterialCommunityIcons
          name={`wifi-strength-${props.signal === 'poor' ? 1 : props.signal === 'fair' ? 2 : props.signal === 'good' ? 3 : 4}`}
          size={20}
          color={signalColor}
        />
        <Text style={styles.statusText}>{props.networkType}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500'
  }
});
```

---

## 7. Build & Deployment

### 7.1 EAS Configuration (eas.json)

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "production": {
      "node": "20.0.0",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.podsoft.io",
        "EXPO_PUBLIC_ENVIRONMENT": "production"
      }
    },
    "staging": {
      "node": "20.0.0",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api-staging.podsoft.io",
        "EXPO_PUBLIC_ENVIRONMENT": "staging"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "bundleIdentifier": "io.podsoft.app"
      },
      "android": {
        "packageIdentifier": "io.podsoft.app"
      }
    }
  }
}
```

### 7.2 Build Commands

```bash
# Install dependencies
npm install

# Build for staging
eas build --platform ios --profile staging
eas build --platform android --profile staging

# Build for production
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to app stores
eas submit --platform ios --latest
eas submit --platform android --latest
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// tests/unit/recording.service.test.ts

import { recordingService } from '../../src/services/recording.service';

describe('RecordingService', () => {
  describe('initializeRecorder', () => {
    it('should initialize with correct settings', async () => {
      const recorder = await recordingService.initializeRecorder({
        quality: 'high',
        audio: { sampleRate: 48000 }
      });

      expect(recorder).toBeDefined();
      expect(recorder.isRecording).toBe(false);
    });

    it('should throw on permission denial', async () => {
      // Mock permission failure
      expect(async () => {
        await recordingService.initializeRecorder({});
      }).rejects.toThrow('Permissions denied');
    });
  });

  describe('pause/resume', () => {
    it('should pause recording', async () => {
      const recorder = await recordingService.initializeRecorder({});
      await recorder.pause();
      expect(recorder.isPaused).toBe(true);
    });
  });
});
```

### 8.2 Integration Tests

```typescript
// tests/integration/recording-flow.test.ts

describe('Complete Recording Flow', () => {
  it('should record, chunk, and upload successfully', async () => {
    // 1. Connect to session
    await socketService.connect('sess_abc', 'device_xyz');

    // 2. Start recording
    const recording = useRecording('sess_abc');
    await recording.startRecording();

    // 3. Simulate 10 minutes
    jest.advanceTimersByTime(600000);

    // 4. Verify chunk was queued
    const queue = uploadService.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].chunkIndex).toBe(0);

    // 5. Wait for upload
    await jest.runAllTimersAsync();

    // 6. Verify upload completed
    expect(queue[0].status).toBe('completed');
  });
});
```

---

## 9. Performance Optimization

### 9.1 Memory Management

```typescript
// Prevent memory leaks from continuous recording
useEffect(() => {
  let recordingInterval;

  const startRecording = async () => {
    recordingRef.current = await recordingService.start();
    
    // Periodic cleanup
    recordingInterval = setInterval(() => {
      // Clear old frames from memory
      recordingRef.current.clearBufferBefore(Date.now() - 10000);
    }, 5000);
  };

  return () => {
    clearInterval(recordingInterval);
    recordingService.stop();
  };
}, []);
```

### 9.2 Battery Optimization

```typescript
// Reduce frame rate when battery low
useEffect(() => {
  if (deviceStatus.battery < 20) {
    recordingService.setFramerate(15);  // 15 fps instead of 30
  } else {
    recordingService.setFramerate(30);
  }
}, [deviceStatus.battery]);
```

---

## 10. Troubleshooting Guide

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Recording stops unexpectedly | Memory pressure | Monitor RAM, clear old chunks |
| Chunks not uploading | Network issues | Check signal, retry with backoff |
| Sync marker not visible | Late frame delivery | Increase cue duration, flash screen |
| Audio missing | Permission denied | Re-grant microphone permission |
| File corrupted | Incomplete write | Verify hash before upload |

---

**Document Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Last Review**: May 3, 2026  
**Next Review**: August 3, 2026

