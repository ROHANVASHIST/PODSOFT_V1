import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '../../lib/shared/socket-events';
import { Camera, RefreshCw, Mic, MicOff, Wifi, AlertCircle, CheckCircle2 } from 'lucide-react';

export const MobileCameraStreamer: React.FC = () => {
  const [roomId, setRoomId] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let r = urlParams.get('room') || '';
    if (r.startsWith('podsoft:')) r = r.replace('podsoft:', '');
    return r;
  });
  const [isJoined, setIsJoined] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'paired' | 'live' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('Enter Studio ID or scan QR code');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const startLocalStream = async (mode: 'user' | 'environment') => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
      return stream;
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setStatus('error');
      setStatusMsg('Camera access denied. Check browser permissions.');
      return null;
    }
  };

  const toggleCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    const stream = await startLocalStream(newMode);
    if (stream && peerConnection.current) {
      const videoTrack = stream.getVideoTracks()[0];
      const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    }
  };

  const connectToStudio = async () => {
    if (!roomId.trim()) return;
    setStatus('connecting');
    setStatusMsg('Connecting to signaling server...');
    setIsJoined(true);

    const stream = await startLocalStream(facingMode);
    if (!stream) return;

    socketRef.current = io(window.location.origin);

    socketRef.current.on('connect', () => {
      setStatusMsg('Joining studio room...');
      socketRef.current?.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId: roomId.trim(), role: 'camera' });
    });

    socketRef.current.on(SOCKET_EVENTS.PAIRED, async () => {
      setStatus('paired');
      setStatusMsg('Studio paired! Establishing secure video link...');

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit(SOCKET_EVENTS.SIGNAL, { 
            roomId: roomId.trim(), 
            signal: { type: 'candidate', candidate: event.candidate } 
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setStatus('live');
          setStatusMsg('BROADCAST LIVE');
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setStatus('error');
          setStatusMsg('Connection lost. Please reconnect.');
        }
      };

      try {
        const offer = await pc.createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false });
        await pc.setLocalDescription(offer);
        socketRef.current?.emit(SOCKET_EVENTS.SIGNAL, { 
          roomId: roomId.trim(), 
          signal: { type: 'offer', sdp: offer } 
        });
      } catch (e) {
        console.error('Failed to create offer:', e);
      }
    });

    socketRef.current.on(SOCKET_EVENTS.SIGNAL, async (data: any) => {
      if (!peerConnection.current) return;
      const { signal } = data;
      if (signal?.type === 'answer') {
        const sdpObj = signal.sdp?.sdp ? signal.sdp : { type: 'answer', sdp: signal.sdp };
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdpObj));
      } else if (signal?.type === 'candidate') {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    });
  };

  useEffect(() => {
    if (roomId && !isJoined) {
      connectToStudio();
    }
    return () => {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      peerConnection.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="relative flex flex-col h-screen w-screen bg-black overflow-hidden font-sans select-none text-white">
      {/* Background Cam Preview */}
      <div className="absolute inset-0 z-0 bg-zinc-950 flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* Top Bar Status */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600 shadow-lg shadow-blue-500/50 flex items-center justify-center">
            <Camera size={18} className="text-white" />
          </div>
          <span className="font-black italic tracking-wider text-sm uppercase">PodSoft Mobile</span>
        </div>

        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
          {status === 'live' && <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]" />}
          {status === 'paired' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />}
          {status === 'connecting' && <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />}
          {status === 'error' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
          {status === 'idle' && <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />}
          <span className="text-xs font-bold uppercase tracking-wider">
            {status === 'live' ? 'LIVE BROADCAST' : status}
          </span>
        </div>
      </div>

      {/* Center Setup Modal (When not joined) */}
      {!isJoined && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
          <div className="w-full max-w-sm bg-zinc-900 border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Wifi size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">Connect Mobile Feed</h2>
              <p className="text-xs text-zinc-400 mt-1.5">Enter your Studio Room Code or ID below to pair your device as a studio camera.</p>
            </div>
            
            <div className="w-full">
              <input 
                type="text" 
                placeholder="e.g. PS-A1B2 or Studio ID"
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                className="w-full px-4 py-3 bg-black/50 border border-white/15 rounded-xl font-mono text-center text-lg text-white font-bold tracking-widest placeholder:text-zinc-600 placeholder:font-normal focus:outline-none focus:border-blue-500 shadow-inner"
              />
            </div>

            <button 
              onClick={connectToStudio}
              disabled={!roomId.trim()}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:pointer-events-none font-black text-sm uppercase tracking-wider rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all transform active:scale-95 text-white"
            >
              Connect to Broadcast
            </button>
          </div>
        </div>
      )}

      {/* Floating Status Notification */}
      {isJoined && status !== 'live' && (
        <div className="absolute top-20 inset-x-4 z-20 flex justify-center pointer-events-none">
          <div className="bg-zinc-900/90 border border-white/15 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3">
            {status === 'connecting' && <RefreshCw size={18} className="text-blue-400 animate-spin" />}
            {status === 'paired' && <CheckCircle2 size={18} className="text-amber-400" />}
            {status === 'error' && <AlertCircle size={18} className="text-red-500" />}
            <span className="text-xs font-bold tracking-wide">{statusMsg}</span>
          </div>
        </div>
      )}

      {/* Bottom Floating Controls */}
      {isJoined && (
        <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center items-center gap-6 pointer-events-none">
          <div className="flex items-center gap-4 bg-zinc-900/80 border border-white/15 px-6 py-3 rounded-full backdrop-blur-lg shadow-2xl pointer-events-auto">
            <button 
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' : 'bg-white/10 hover:bg-white/20 text-white'}`}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <div className="w-px h-8 bg-white/15" />

            <button 
              onClick={toggleCamera}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:rotate-180 duration-300"
            >
              <RefreshCw size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
