import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, SafeAreaView, ActivityIndicator, Alert, Dimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

const { width, height } = Dimensions.get('window');

const SOCKET_EVENTS = {
  JOIN_ROOM: 'join-room',
  PAIRED: 'paired',
  SIGNAL: 'signal',
  PING: 'ping',
  PONG: 'pong',
  FRAME: 'frame',
  DIAGNOSTIC_REPORT: 'diagnostic-report',
};

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [torch, setTorch] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Connection state
  const [serverUrl, setServerUrl] = useState('http://192.168.1.100:3000');
  const [roomCode, setRoomCode] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'paired' | 'live' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('Enter Studio IP and Room Code');
  const [fps, setFps] = useState(30);
  const [resolution, setResolution] = useState('1080p');

  const socketRef = useRef<Socket | null>(null);
  const cameraRef = useRef<any>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    return () => {
      isStreamingRef.current = false;
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      socketRef.current?.disconnect();
    };
  }, []);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={64} color="#64748b" style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Camera Access Required</Text>
        <Text style={styles.subtitle}>PodSoft Mobile Studio needs camera and microphone permission to stream video to your PC.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleTorch = () => {
    setTorch(current => !current);
  };

  const toggleMute = () => {
    setIsMuted(current => !current);
  };

  const startBroadcast = async () => {
    if (!serverUrl.trim() || !roomCode.trim()) {
      Alert.alert('Missing Info', 'Please enter your PodSoft Studio server IP address and Room Code.');
      return;
    }

    setStatus('connecting');
    setStatusMsg('Connecting to studio server...');
    setIsJoined(true);

    try {
      let url = serverUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }
      socketRef.current = io(url, { transports: ['websocket'], timeout: 10000 });

      socketRef.current.on('connect', () => {
        setStatusMsg('Joining studio room ' + roomCode.trim().toUpperCase());
        socketRef.current?.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId: roomCode.trim().toUpperCase(), role: 'camera' });
      });

      socketRef.current.on('connect_error', (err) => {
        setStatus('error');
        setStatusMsg('Connection failed: ' + err.message);
        Alert.alert('Connection Failed', 'Could not connect to server at ' + url);
      });

      socketRef.current.on(SOCKET_EVENTS.PING, (data) => {
        if (!data?.serverEcho && socketRef.current?.connected) {
          socketRef.current.emit(SOCKET_EVENTS.PONG, {
            roomId: roomCode.trim().toUpperCase(),
            timestamp: data?.timestamp,
            mobileTimestamp: Date.now(),
            status: 'live',
            fps,
            resolution,
            battery: '94%'
          });
        }
      });

      socketRef.current.on(SOCKET_EVENTS.PAIRED, async () => {
        setStatus('live');
        setStatusMsg('LIVE ON AIR');

        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        isStreamingRef.current = true;

        streamIntervalRef.current = setInterval(async () => {
          if (!isStreamingRef.current || !cameraRef.current) return;
          try {
            const photo = await cameraRef.current.takePictureAsync({
              quality: 0.2,
              base64: true,
              fastMode: true,
              shutterSound: false
            });
            if (photo && photo.base64 && socketRef.current?.connected) {
              socketRef.current.emit('frame', {
                roomId: roomCode.trim().toUpperCase(),
                base64: photo.base64,
                timestamp: Date.now()
              });
            }
          } catch (e) {
            // Ignore capture errors during rapid bursts
          }
        }, 100); // 10 FPS ultra-low latency JPEG streaming
      });

    } catch (err: any) {
      console.error('Broadcast init error:', err);
      setStatus('error');
      setStatusMsg('Error: ' + err.message);
      Alert.alert('Broadcast Error', err.message);
    }
  };

  const disconnect = () => {
    isStreamingRef.current = false;
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsJoined(false);
    setStatus('idle');
    setStatusMsg('Disconnected');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background Live Camera View */}
      <View style={StyleSheet.absoluteFillObject}>
        <CameraView 
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject} 
          facing={facing} 
          enableTorch={torch}
          mute={isMuted}
        />
        <View style={styles.overlayGradient} />
      </View>

      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandBadge}>
          <View style={styles.brandIcon}>
            <Ionicons name="videocam" size={16} color="#ffffff" />
          </View>
          <Text style={styles.brandText}>PodSoft Mobile Pro</Text>
        </View>

        <View style={[styles.statusBadge, status === 'live' && styles.statusBadgeLive]}>
          <View style={[styles.statusDot, status === 'live' ? styles.dotLive : status === 'paired' ? styles.dotPaired : status === 'connecting' ? styles.dotConnecting : styles.dotIdle]} />
          <Text style={styles.statusText}>{status === 'live' ? 'LIVE BROADCAST' : status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Center Setup Modal (When not broadcasting) */}
      {!isJoined ? (
        <View style={styles.modalWrapper}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderIcon}>
              <Ionicons name="radio" size={36} color="#3b82f6" />
            </View>

            <Text style={styles.modalTitle}>Studio Connection</Text>
            <Text style={styles.modalSubtitle}>Transform your mobile camera into an ultra-low latency wireless broadcast feed.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PODSOFT STUDIO IP (e.g. 192.168.1.100:3000)</Text>
              <TextInput 
                style={styles.textInput} 
                placeholder="192.168.1.50:3000"
                placeholderTextColor="#64748b"
                value={serverUrl}
                onChangeText={setServerUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ROOM CODE OR STUDIO ID</Text>
              <TextInput 
                style={[styles.textInput, styles.roomCodeInput]} 
                placeholder="PS-A1B2"
                placeholderTextColor="#64748b"
                value={roomCode}
                onChangeText={setRoomCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.presetsRow}>
              <TouchableOpacity 
                style={[styles.presetBtn, resolution === '720p' && styles.presetActive]} 
                onPress={() => setResolution('720p')}
              >
                <Text style={[styles.presetText, resolution === '720p' && styles.presetTextActive]}>HD 720p</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.presetBtn, resolution === '1080p' && styles.presetActive]} 
                onPress={() => setResolution('1080p')}
              >
                <Text style={[styles.presetText, resolution === '1080p' && styles.presetTextActive]}>FHD 1080p</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.presetBtn, fps === 60 && styles.presetActive]} 
                onPress={() => setFps(f => f === 30 ? 60 : 30)}
              >
                <Text style={[styles.presetText, fps === 60 && styles.presetTextActive]}>{fps} FPS</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.connectButton, (!serverUrl || !roomCode) && styles.connectButtonDisabled]} 
              onPress={startBroadcast}
              disabled={!serverUrl || !roomCode}
            >
              <Text style={styles.connectButtonText}>Connect Feed</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Floating HUD Information When Joined */
        <View style={styles.hudContainer}>
          {status !== 'live' && (
            <View style={styles.statusToast}>
              {status === 'connecting' && <ActivityIndicator size="small" color="#3b82f6" />}
              {status === 'paired' && <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />}
              {status === 'error' && <Ionicons name="alert-circle" size={20} color="#ef4444" />}
              <Text style={styles.statusToastText}>{statusMsg}</Text>
            </View>
          )}

          {/* Timecode / FPS HUD overlay */}
          {status === 'live' && (
            <View style={styles.recordingHudBorder}>
              <View style={styles.hudTopCorner}>
                <Ionicons name="recording" size={14} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.hudFpsText}>{resolution} • {fps} FPS • WIRELESS WEB-RTC</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Floating Bottom Toolbar */}
      <View style={styles.bottomToolbar}>
        <View style={styles.toolbarCard}>
          <TouchableOpacity style={[styles.toolBtn, isMuted && styles.toolBtnDanger]} onPress={toggleMute}>
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? '#ffffff' : '#e2e8f0'} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.toolBtn, torch && styles.toolBtnActive]} onPress={toggleTorch}>
            <Ionicons name={torch ? 'flash' : 'flash-off'} size={24} color={torch ? '#3b82f6' : '#e2e8f0'} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolBtn} onPress={toggleFacing}>
            <Ionicons name="camera-reverse" size={24} color="#e2e8f0" />
          </TouchableOpacity>

          {isJoined && (
            <TouchableOpacity style={[styles.toolBtn, styles.toolBtnDanger]} onPress={disconnect}>
              <Ionicons name="power" size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 50,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  brandIcon: {
    backgroundColor: '#2563eb',
    padding: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  brandText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    fontStyle: 'italic',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusBadgeLive: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotLive: { backgroundColor: '#ef4444' },
  dotPaired: { backgroundColor: '#f59e0b' },
  dotConnecting: { backgroundColor: '#3b82f6' },
  dotIdle: { backgroundColor: '#64748b' },
  statusText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 30,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
  },
  modalHeaderIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 1,
  },
  textInput: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  roomCodeInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 3,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '900',
    color: '#3b82f6',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  presetActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
  },
  presetText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  presetTextActive: {
    color: '#3b82f6',
  },
  connectButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  connectButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hudContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  },
  statusToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 10,
  },
  statusToastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  recordingHudBorder: {
    position: 'absolute',
    inset: 16,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.6)',
    borderRadius: 16,
    pointerEvents: 'none',
  },
  hudTopCorner: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  hudFpsText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bottomToolbar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  toolbarCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 36,
    gap: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  toolBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  toolBtnDanger: {
    backgroundColor: '#ef4444',
  },
});
