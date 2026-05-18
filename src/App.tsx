import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MobileCameraStreamer } from './components/mobile/MobileCameraStreamer';
import { SOCKET_EVENTS } from './lib/shared/socket-events';

import { QRCodeSVG } from 'qrcode.react';
import { DriveView } from './components/DriveView';
import { 
  Settings, 
  Radio, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Activity,
  Maximize2,
  Lock,
  Eye,
  EyeOff,
  MoreVertical,
  Volume2,
  VolumeX,
  Camera,
  Monitor,
  WifiOff,
  Globe,
  ExternalLink,
  X,
  Image as ImageIcon,
  Type,
  Video,
  LogOut,
  LogIn,
  Database,
  History,
  FileCode,
  Layout,
  User as UserIcon,
  FolderOpen,
  Sparkles,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSupabase } from './components/SupabaseProvider';
// import { db, handleFirestoreError, OperationType } from './lib/firebase'; 
// import { 
//   collection, 
//   query, 
//   where, 
//   onSnapshot, 
//   addDoc, 
//   setDoc, 
//   deleteDoc, 
//   doc, 
//   serverTimestamp,
//   orderBy,
//   getDocs,
//   getDoc,
//   limit,
//   updateDoc
// } from 'firebase/firestore';
// TODO: Implement data synchronization with Supabase

const OperationType = { CREATE: 'create', UPDATE: 'update', DELETE: 'delete', LIST: 'list' };
const handleFirestoreError = (error: any, op: any, table?: string) => console.error(`Error in ${table || 'unknown table'} during ${op}:`, error);
const localDb: any = {
  studios: [],
  scenes: [],
  sceneItems: [],
  users: []
};

// Simplified local implementations
const db = {};
const collection = (db: any, name: string) => name;
const doc = (db: any, name: string, id: string) => ({ id });
const addDoc = async (col: string, data: any) => {
    const id = Math.random().toString(36).substring(7);
    localDb[col] = localDb[col] || [];
    localDb[col].push({ id, ...data });
    return { id };
};
const setDoc = async (docRef: any, data: any) => {};
const updateDoc = async (docRef: any, data: any) => {};
const deleteDoc = async (docRef: any) => {};
const query = (...args: any[]) => ({});
const where = (...args: any[]) => ({});
const orderBy = (...args: any[]) => ({});
const limit = (...args: any[]) => ({});
const onSnapshot = (q: any, callback: any) => {
    callback({ docs: [] });
    return () => {};
};
const getDocs = async (q: any) => ({ empty: true, docs: [] });
const getDoc = async (docRef: any) => ({ exists: () => false, data: () => ({}) });
const serverTimestamp = () => new Date();


// --- Types ---
interface Source {
  id: string;
  name: string;
  type: 'camera' | 'screen' | 'image' | 'text' | 'droidcam';
  visible: boolean;
  locked: boolean;
  stream?: MediaStream; // Local only
  url?: string;
  volume: number;
  isMuted: boolean;
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    chromaKey?: {
      enabled: boolean;
      color: string;
      similarity: number;
      smoothness: number;
    };
  };
}

interface Scene {
  id: string;
  name: string;
  sources: Source[];
}

// --- Utils ---
const isLocalIP = (urlStr: string) => {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    
    const parts = hostname.split('.').map(Number);
    if (parts.length !== 4) return false;

    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 100.64.0.0/10 (CGNAT/Tailscale)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    
    return false;
  } catch {
    return false;
  }
};

// --- Components ---

const DockHeader = ({ title, children }: { title: string, children?: React.ReactNode }) => (
  <div className="obs-dock-header">
    <span>{title}</span>
    <div className="flex items-center gap-1">
      {children}
      <MoreVertical size={12} className="cursor-pointer hover:text-white" />
    </div>
  </div>
);

const Dock = ({ id, title, className, children, headerIcons }: { id?: string, title: string, className?: string, children: React.ReactNode, headerIcons?: React.ReactNode }) => (
  <div id={id} className={`obs-card flex flex-col min-h-0 ${className}`}>
    <DockHeader title={title}>{headerIcons}</DockHeader>
    <div className="flex-1 overflow-auto p-1">
      {children}
    </div>
  </div>
);

const SourceVideo = ({ 
  id,
  stream, 
  url, 
  locked, 
  filters, 
  type,
  volume = 1.0,
  isMuted = false,
  onVolumeChange
}: { 
  id: string,
  stream?: MediaStream, 
  url?: string, 
  locked: boolean, 
  filters?: Source['filters'], 
  type: Source['type'],
  volume?: number,
  isMuted?: boolean,
  onVolumeChange?: (volume: number, isMuted: boolean) => void
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isChromaActive, setIsChromaActive] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  
  // Use the stream prop if provided, otherwise default to status management
  const [status, setStatus] = useState<'connecting' | 'connected' | 'failed'>((stream || type !== 'droidcam') ? 'connected' : 'connecting');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);

  // Update status if stream becomes available
  useEffect(() => {
    if (stream) setStatus('connected');
  }, [stream]);

  const startWatchdog = () => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    if (type !== 'droidcam' || stream) return;

    // Transition to failed if neither onLoad nor onError fires within 45 seconds
    watchdogRef.current = setTimeout(() => {
      if (status === 'connecting') {
        console.warn("DroidCam connection watchdog: Timeout reached (45s). Check reachability.");
        setStatus('failed');
      }
    }, 45000);
  };

  const checkProxyError = async () => {
    if (!url || type !== 'droidcam') return;
    
    const isLocal = isLocalIP(url);
    if (isLocal) {
      setErrorDetails(`Direct connection to ${new URL(url).hostname} failed. Browsers block local network requests from cloud-hosted apps.`);
      setErrorCode("LOCAL_IP_BLOCKED");
      return;
    }

    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&retry=${retryKey}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for error check
      
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: response.statusText, code: "HTTP_" + response.status };
        }
        setErrorDetails(errorData.details || errorData.error || "Unexpected proxy error");
        setErrorCode(errorData.code || "UNKNOWN");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setErrorDetails("The connection attempt is still hanging. Cloud environments cannot reach local device IPs directly.");
        setErrorCode("TIMEOUT");
      } else {
        setErrorDetails(err.message || "Network failure during signal check.");
        setErrorCode("FETCH_ERROR");
      }
    }
  };

  const handleRetry = () => {
    setRetryKey(prev => prev + 1);
    setStatus('connecting');
    setErrorDetails(null);
    setErrorCode(null);
    setShowTroubleshoot(false);
    startWatchdog();
  };

  useEffect(() => {
    if (type === 'droidcam') {
      setStatus('connecting');
      startWatchdog();
    }
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, [url, type]);

  const isMixedContent = window.location.protocol === 'https:' && url?.startsWith('http://');

  const getTroubleshootingItems = () => {
    const items = [
      {
        icon: <Lock size={12} className="text-blue-400" />,
        title: "Mixed Content Block",
        desc: "Browsers block HTTP streams on HTTPS sites. Enable 'Insecure Content' in Site Settings (padlock icon)."
      },
      {
        icon: <WifiOff size={12} className="text-amber-400" />,
        title: "Connection Timed Out",
        desc: "We waited 30s but didn't get a response. Check if DroidCam is open and processing video on your device."
      }
    ];

    if (url && isLocalIP(url)) {
      items.unshift({
        icon: <Globe size={12} className="text-red-400" />,
        title: "Direct Local Connection",
        desc: "We are attempting a direct browser connection (OBS-style). If it fails, open this app in a NEW TAB to bypass security restrictions."
      });
    } else {
      items.unshift({
        icon: <Globe size={12} className="text-red-400" />,
        title: "Cloud Reachability",
        desc: "If you used a local IP, it won't work in the cloud. Use a Public IP or a tunnel like LocalTunnel/Ngrok."
      });
    }

    return items;
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    setIsChromaActive(!!filters?.chromaKey?.enabled);
  }, [filters?.chromaKey?.enabled]);

  useEffect(() => {
    if (!isChromaActive || (!videoRef.current && type !== 'droidcam')) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animationId: number;
    const proxiedUrl = type === 'droidcam' && url ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
    const sourceEl = type === 'droidcam' ? (document.querySelector(`img[src*="proxy?url=${encodeURIComponent(url || '')}"]`) as HTMLImageElement) : videoRef.current;

    const processFrame = () => {
      if (!sourceEl || (sourceEl instanceof HTMLVideoElement && sourceEl.paused)) {
        animationId = requestAnimationFrame(processFrame);
        return;
      }

      const width = sourceEl instanceof HTMLVideoElement ? sourceEl.videoWidth : (sourceEl as HTMLImageElement).naturalWidth || sourceEl.clientWidth;
      const height = sourceEl instanceof HTMLVideoElement ? sourceEl.videoHeight : (sourceEl as HTMLImageElement).naturalHeight || sourceEl.clientHeight;

      if (width === 0 || height === 0) {
        animationId = requestAnimationFrame(processFrame);
        return;
      }

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.drawImage(sourceEl, 0, 0, width, height);
      
      if (filters?.chromaKey?.enabled) {
        const frame = ctx.getImageData(0, 0, width, height);
        const data = frame.data;
        const keyColor = hexToRgb(filters.chromaKey.color || '#00ff00');
        const similarity = filters.chromaKey.similarity / 100;
        const smoothness = filters.chromaKey.smoothness / 100;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const diff = Math.sqrt(
            Math.pow(r - keyColor.r, 2) +
            Math.pow(g - keyColor.g, 2) +
            Math.pow(b - keyColor.b, 2)
          ) / 441.67; // Normalize to 0-1 (sqrt(255^2 * 3) approx 441.67)

          if (diff < similarity) {
            data[i + 3] = 0;
          } else if (diff < similarity + smoothness) {
            data[i + 3] = ((diff - similarity) / smoothness) * 255;
          }
        }
        ctx.putImageData(frame, 0, 0);
      }

      animationId = requestAnimationFrame(processFrame);
    };

    processFrame();
    return () => cancelAnimationFrame(animationId);
  }, [isChromaActive, filters?.chromaKey, type, url]);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 };
  };

  const filterStyle = filters ? {
    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`
  } : {};

  const isLocal = isLocalIP(url || '');
  const isHttps = window.location.protocol === 'https:';
  const displayUrl = (url && isLocal && !isHttps) ? url : (url ? `/api/proxy?url=${encodeURIComponent(url)}&retry=${retryKey}` : undefined);

  return (
    <div className="relative w-full h-full overflow-hidden" data-source-id={id}>
      {type === 'droidcam' && url && !stream && (
        <div id={`source-container-${(url || '').replace(/[^a-zA-Z0-9]/g, '')}`} className="w-full h-full bg-zinc-900 group relative flex flex-col items-center justify-center overflow-hidden font-sans">
          <img 
            src={displayUrl}
            data-source-id={id}
            alt="DroidCam Stream"
            style={filterStyle}
            onLoad={() => {
              if (watchdogRef.current) clearTimeout(watchdogRef.current);
              setStatus('connected');
            }}
            onError={() => {
              if (watchdogRef.current) clearTimeout(watchdogRef.current);
              setStatus('failed');
              checkProxyError();
            }}
            className={`w-full h-full object-contain transition-[filter,opacity] duration-300 ${locked ? '' : 'pointer-events-none'} ${isChromaActive ? 'hidden' : ''} ${status === 'connected' ? 'opacity-100' : 'opacity-0'}`}
          />
          
          {/* Connecting Indicator */}
          {status === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-obs-bg gap-4 z-20">
              {isMixedContent && (
                <div className="absolute top-4 left-4 right-4 bg-amber-500/10 border border-amber-500/20 p-2 rounded flex items-center gap-3 animate-bounce">
                  <Lock size={14} className="text-amber-500" />
                  <p className="text-[9px] text-amber-200/80 leading-tight">
                    <strong>Mixed Content Warning:</strong> Browser may block HTTP streams on HTTPS sites. Check troubleshooting.
                  </p>
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="w-12 h-12 border-2 border-blue-500/20 rounded-full" />
                  <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Radio size={16} className="text-blue-500 animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic mb-1">Establishing Signal</span>
                  <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-1/2 h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[8px] text-zinc-500 font-mono tracking-tighter uppercase">{url.split('/')[2]}</p>
                <button 
                  onClick={() => {
                    if (watchdogRef.current) clearTimeout(watchdogRef.current);
                    setStatus('connected');
                  }}
                  className="text-[8px] text-blue-400 hover:text-blue-300 underline uppercase font-bold"
                >
                  Force Display
                </button>
              </div>
            </div>
          )}

          {/* Connection Tooltip / Error (DroidCam specific) */}
          {status === 'failed' && (
            <div id={`droidcam-error-${(url || '').replace(/[^a-zA-Z0-9]/g, '')}`} className="droidcam-error absolute inset-0 bg-obs-bg/98 p-4 flex flex-col items-center justify-center text-center gap-3 z-30 border-2 border-red-500/20 backdrop-blur-xl">
             {!showTroubleshoot ? (
               <>
                 <div className="bg-red-500/20 p-3 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                   <WifiOff size={28} className="text-red-500" />
                 </div>
                 <div className="flex flex-col gap-1">
                   <span className="text-xs font-black text-white uppercase tracking-wider italic">Source Offline</span>
                   <p className="text-[10px] text-zinc-400 max-w-[240px] leading-snug">
                     Stream from <span className="text-white font-mono">{url.split('/')[2]}</span> could not be established.
                   </p>
                   {errorDetails && (
                     <div className="mt-2 bg-red-950/40 border border-red-500/20 p-2 rounded text-left">
                       <p className="text-[8px] text-red-300 font-mono leading-relaxed">
                         <span className="font-bold opacity-70">REASON:</span> {errorDetails}
                       </p>
                       {isLocalIP(url) && (
                         <div className="mt-2 flex flex-col gap-1">
                           <p className="text-[8px] text-red-400 font-bold uppercase animate-pulse">
                             ⚠️ Private Network Access
                           </p>
                           <p className="text-[7px] text-zinc-500 leading-tight italic">
                             Chrome blocks cloud sites from reaching local IPs. Fix:
                           </p>
                           <button 
                              onClick={() => url && window.open(url, '_blank')}
                              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-[8px] font-bold rounded flex items-center justify-center gap-1 transition-colors border border-white/10"
                            >
                              <ExternalLink size={8} />
                              1. TRUST PHONE STREAM (AUTHORIZE)
                              </button>
                              <button 
                                onClick={() => window.open(window.location.href, '_blank')}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-[8px] font-bold rounded flex items-center justify-center gap-1 transition-colors"
                              >
                                <ExternalLink size={8} />
                                2. RE-OPEN APP IN NEW TAB
                           </button>
                         </div>
                       )}
                     </div>
                   )}
                 </div>
                 <div className="flex flex-col gap-2 w-full max-w-[200px]">
                   <button 
                     onClick={handleRetry}
                     className="text-[9px] bg-blue-600 text-white py-2 rounded font-black uppercase hover:bg-blue-500 transition-all shadow-lg active:scale-95"
                   >
                     Retry Connection
                   </button>
                   <div className="grid grid-cols-2 gap-2">
                     <a href={url} target="_blank" rel="noreferrer" className="text-[8px] bg-zinc-800 text-white py-1.5 rounded font-bold uppercase hover:bg-zinc-700 transition-colors border border-white/5 flex items-center justify-center">Test Link</a>
                     <button 
                       onClick={() => setShowTroubleshoot(true)}
                       className="text-[8px] bg-zinc-800 text-white py-1.5 rounded font-bold uppercase hover:bg-zinc-700 transition-colors border border-white/5"
                     >
                       Troubleshoot
                     </button>
                   </div>
                 </div>
               </>
             ) : (
               <div className="w-full h-full flex flex-col p-2">
                 <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                   <div className="flex items-center gap-2">
                     <Settings size={14} className="text-blue-400" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Connectivity Guide</span>
                   </div>
                   <button 
                     onClick={() => setShowTroubleshoot(false)} 
                     className="text-[10px] bg-white/5 hover:bg-white/10 p-1 rounded transition-colors"
                   >
                     <X size={12} className="text-zinc-400" />
                   </button>
                 </div>
                 
                 <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
                   {getTroubleshootingItems().map((item, idx) => (
                     <div key={idx} className="flex gap-2 text-left bg-white/[0.03] p-2 rounded border border-white/[0.05]">
                       <div className="mt-0.5">{item.icon}</div>
                       <div className="flex flex-col gap-0.5">
                         <span className="text-[9px] font-bold text-white uppercase">{item.title}</span>
                         <p className="text-[8px] text-zinc-400 leading-tight">{item.desc}</p>
                       </div>
                     </div>
                   ))}
                   
                   <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded flex flex-col gap-1 mt-auto">
                     <div className="flex items-center gap-1.5 text-blue-300 font-bold text-[8px] uppercase">
                       <Monitor size={10} />
                       <span>Pro Tip</span>
                     </div>
                     <p className="text-[8px] text-blue-200/60 leading-tight italic">
                       If running on Chrome/Edge, click the padlock &gt; Site Settings &gt; Insecure Content &gt; "Allow".
                     </p>
                   </div>
                 </div>

                 <button 
                   onClick={handleRetry}
                   className="mt-3 text-[9px] bg-zinc-100 text-black py-2 rounded font-black uppercase hover:bg-white transition-colors"
                 >
                   Re-Attempt Connection
                 </button>
               </div>
             )}
          </div>
          )}

          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded border border-white/5 z-20">
             <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : status === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
             <span className="text-[8px] font-bold text-zinc-300 uppercase">
               {status === 'connected' ? 'STREAM: LIVE' : status === 'connecting' ? 'SIGNAL: SEARCHING' : 'SIGNAL: OFFLINE'}
             </span>
          </div>

          {/* Hover Controls (DroidCam Specific) */}
          {status === 'connected' && (
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-40 flex items-end justify-center pb-8 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
              <div className="flex items-center gap-2 bg-obs-bg/90 border border-obs-border p-2 rounded-lg shadow-2xl pointer-events-auto backdrop-blur-md">
                <button 
                  onClick={() => onVolumeChange?.(volume, !isMuted)}
                  className={`p-1.5 rounded hover:bg-white/10 transition-colors ${isMuted ? 'text-red-500' : 'text-blue-400'}`}
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                
                <div className="relative flex items-center group/vol">
                  <div className="w-20 h-1 bg-white/10 rounded-full relative">
                    <div 
                      className="absolute left-0 h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                      style={{ width: isMuted ? '0%' : `${volume * 100}%` }}
                    />
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => onVolumeChange?.(parseFloat(e.target.value), false)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-[9px] font-mono w-8 text-right text-zinc-400 ml-1">
                    {isMuted ? '0' : Math.round(volume * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(type !== 'droidcam' || stream) && (
        <video 
          ref={videoRef} 
          data-source-id={id}
          autoPlay 
          playsInline 
          muted 
          style={filterStyle}
          className={`w-full h-full object-cover rounded-sm transition-[filter] duration-200 ${locked ? '' : 'pointer-events-none'} ${isChromaActive ? 'hidden' : ''}`}
        />
      )}

      {isChromaActive && (
        <canvas 
          ref={canvasRef}
          style={filterStyle}
          className={`w-full h-full object-contain rounded-sm ${locked ? '' : 'pointer-events-none'}`}
        />
      )}
    </div>
  );
};

type SessionState = 'prep' | 'recording' | 'paused' | 'stopped' | 'processing' | 'ready' | 'archived' | 'failed';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'mobile') {
    return <MobileCameraStreamer />;
  }

  const { user, login, logout, signup, loginWithEmail, loading: authLoading } = useSupabase();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState('');
  const [studioId, setStudioId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [mobileConnected, setMobileConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('prep');
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'google' | 'signin' | 'signup'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New UI State
  const [currentView, setCurrentView] = useState<'studio' | 'file' | 'edit' | 'view' | 'profile' | 'drive'>('studio');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [screenRecordingId, setScreenRecordingId] = useState<string | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Local-only streams map to persist media between Firestore syncs
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [selectedPreviewSourceId, setSelectedPreviewSourceId] = useState<string | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVirtualCam, setIsVirtualCam] = useState(false);
  const [showInternalProjector, setShowInternalProjector] = useState(false);
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const virtualStreamRef = useRef<MediaStream | null>(null);
  const virtualLoopRef = useRef<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const activeSceneRef = useRef<Scene>({ id: 'empty', name: 'No Scene', sources: [] });

  useEffect(() => {
    const scene = scenes.find(s => s.id === activeSceneId) || scenes[0] || { id: 'empty', name: 'No Scene', sources: [] };
    activeSceneRef.current = scene;
  }, [scenes, activeSceneId]);

  const startVirtualCam = async () => {
    if (!virtualCanvasRef.current) {
      virtualCanvasRef.current = document.createElement('canvas');
    }

    const [width, height] = baseResolution.split('x').map(Number);
    virtualCanvasRef.current.width = width || 1920;
    virtualCanvasRef.current.height = height || 1080;

    const canvas = virtualCanvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    // Verify sources are in a reasonable state before starting capture
    const currentSources = activeSceneRef.current.sources;
    for (const src of currentSources) {
      if (!src.visible) continue;
      const container = document.querySelector(`[data-source-id="${src.id}"]`);
      if (container) {
          const video = container.querySelector('video');
          if (video && video.readyState === 0) {
              console.warn(`Source ${src.name} is not loaded yet.`);
          }
      }
    }

    const renderLoop = () => {
      if (!ctx || !canvas) return;
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const currentSources = activeSceneRef.current.sources;
      for (let i = currentSources.length - 1; i >= 0; i--) {
        const src = currentSources[i];
        if (!src.visible) continue;

        const container = document.querySelector(`[data-source-id="${src.id}"]`);
        if (!container) continue;

        const el = container.querySelector('canvas') || container.querySelector('video') || container.querySelector('img');
        if (!el) continue;

        let isReady = false;
        if (el instanceof HTMLVideoElement) isReady = el.readyState >= 2;
        else if (el instanceof HTMLImageElement) isReady = el.complete && el.naturalWidth > 0;
        else if (el instanceof HTMLCanvasElement) isReady = true;

        if (isReady) {
          ctx.save();
          const b = (src.filters?.brightness || 100) / 100;
          const c = (src.filters?.contrast || 100) / 100;
          const s = (src.filters?.saturation || 100) / 100;
          ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;

          const wPercent = src.type === 'camera' ? 0.4 : 1.0;
          const hPercent = src.type === 'camera' ? 0.4 : 1.0;
          const targetW = canvas.width * wPercent;
          const targetH = canvas.height * hPercent;
          const x = i * 20; 
          const y = i * 20;

          try {
            ctx.drawImage(el as CanvasImageSource, x, y, targetW, targetH);
          } catch (e) {
            console.warn('Skipping tainted source during draw:', src.name);
          }
          ctx.restore();
        }
      }
      virtualLoopRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    try {
      // Small delay to let renderLoop start and canvas initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      virtualStreamRef.current = canvas.captureStream(fpsValue || 60);
      setIsVirtualCam(true);
      
      // Update projector if it's open
      const projector = window.open('', 'VirtualProjector');
      if (projector && !projector.closed) {
          const video = projector.document.getElementById('v') as HTMLVideoElement;
          if (video && virtualStreamRef.current) {
              video.srcObject = virtualStreamRef.current;
          }
      }
      
      return virtualStreamRef.current;
    } catch (e) {
      console.error('Failed to capture stream:', e);
      stopVirtualCam();
      return null;
    }
  };

  const stopVirtualCam = () => {
    if (virtualLoopRef.current) {
      cancelAnimationFrame(virtualLoopRef.current);
      virtualLoopRef.current = null;
    }
    if (virtualStreamRef.current) {
      virtualStreamRef.current.getTracks().forEach(t => t.stop());
      virtualStreamRef.current = null;
    }
    setIsVirtualCam(false);
  };

  const openProjector = () => {
    if (!isVirtualCam) startVirtualCam();
    setShowInternalProjector(true);
    
    // Also try window if possible, but keep internal fallback
    try {
      const projector = window.open('', 'VirtualProjector', 'width=1280,height=720');
      if (projector) {
        projector.document.body.style.margin = '0';
        projector.document.body.style.background = '#000';
        projector.document.body.style.overflow = 'hidden';
        projector.document.title = 'PodSoft Pro - Virtual Projector';
        projector.document.body.innerHTML = `
          <video id="v" autoplay playsinline style="width:100vw;height:100vh;object-fit:contain;background:#000;"></video>
        `;
        const video = projector.document.getElementById('v') as HTMLVideoElement;
        if (video && virtualStreamRef.current) {
          video.srcObject = virtualStreamRef.current;
        }
      }
    } catch (e) {
      console.warn("Popup blocked, using internal projector", e);
    }
  };
  const [studioMode, setStudioMode] = useState(false);
  const [cpuUsage, setCpuUsage] = useState(4.2);
  const [fps] = useState(60.0);
  const [bitrate, setBitrate] = useState(4500);
  
  const [showAddSource, setShowAddSource] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDevicePicker, setShowAddDevicePicker] = useState(false);
  const [showDroidCamInput, setShowDroidCamInput] = useState(false);
  const [droidCamIP, setDroidCamIP] = useState('192.168.1.1');
  const [droidCamPort, setDroidCamPort] = useState('4747');
  const [droidCamQuality, setDroidCamQuality] = useState(70);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveryLog, setDiscoveryLog] = useState('');
  const [selectedSourceType, setSelectedSourceType] = useState<Source['type'] | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showProperties, setShowProperties] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSettingsTab, setSelectedSettingsTab] = useState('General');
  
  // Video Settings State
  const [baseResolution, setBaseResolution] = useState('1920x1080');
  const [outputResolution, setOutputResolution] = useState('1280x720');
  const [fpsValue, setFpsValue] = useState(60);
  const [encoder, setEncoder] = useState('x264 (Software)');

  // Transition Settings
  const [transitionType, setTransitionType] = useState<'Fade' | 'Cut' | 'Swipe' | 'Slide'>('Fade');
  const [transitionDuration, setTransitionDuration] = useState(300);

  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<{ id: string, text: string } | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [showSmartBuild, setShowSmartBuild] = useState(false);
  const [smartBuildPrompt, setSmartBuildPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Screen Recording Specifics
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const activeScene = scenes.find(s => s.id === activeSceneId) || scenes[0] || { id: 'empty', name: 'No Scene', sources: [] };

  // --- Firebase Sync Logic ---

  // 1. Fetch or Create Studio
  useEffect(() => {
    if (!user) {
      setStudioId(null);
      setScenes([]);
      return;
    }

    const loadStudio = async () => {
      // 0. Ensure user profile exists
      const userRef = doc(db, 'users', user.uid);
      try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
            photoURL: user.photoURL || '',
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.warn("User profile check failed:", e);
      }

      const studiosRef = collection(db, 'studios');
      const q = query(studiosRef, where('ownerId', '==', user.uid), limit(1));
      
      try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          // Create default studio
          const newStudio = await addDoc(studiosRef, {
            name: `${user.displayName || 'Default'}'s Studio`,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          setStudioId(newStudio.id);
          
          // Create default scene
          await addDoc(collection(db, 'scenes'), {
            studioId: newStudio.id,
            name: 'Scene 1',
            order: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          setStudioId(querySnapshot.docs[0].id);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'studios');
      }
    };

    loadStudio();
  }, [user]);

  // 2. Sync Scenes
  useEffect(() => {
    if (!studioId) return;

    // WebRTC Signaling Setup
    socketRef.current = io(window.location.origin);
    
    socketRef.current.on('connect', () => {
      console.log('Signaling Connected', socketRef.current?.id);
      if (studioId) {
        socketRef.current?.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId: studioId, role: 'studio' });
        setRoomCode(`PS-${studioId.slice(0, 4).toUpperCase()}`);
      }
    });

    socketRef.current.on(SOCKET_EVENTS.PAIRED, (data) => {
        setMobileConnected(true);
    });

    socketRef.current.on(SOCKET_EVENTS.SIGNAL, async (data) => {
      if (!pcRef.current) setupPeerConnection();
      
      const { signal, senderId } = data;
      if (signal.type === 'offer') {
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pcRef.current?.createAnswer();
          await pcRef.current?.setLocalDescription(answer as RTCSessionDescriptionInit);
          socketRef.current?.emit(SOCKET_EVENTS.SIGNAL, { roomId: studioId, signal: { type: 'answer', sdp: pcRef.current?.localDescription }, to: senderId });
      } else if (signal.type === 'candidate') {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    });

    const setupPeerConnection = () => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.onicecandidate = e => { if (e.candidate) socketRef.current?.emit(SOCKET_EVENTS.SIGNAL, { roomId: studioId, signal: { type: 'candidate', candidate: e.candidate } }); };
        pc.ontrack = e => { 
            console.log('Received track:', e.track);
            const stream = e.streams[0];
            setStreams(prev => ({ ...prev, 'mobile-camera': stream }));
            // TODO: Implement Supabase sync for sources
            // setScenes(prev => prev.map((s, i) => i === 0 ? {...s, sources: [...s.sources, { id: 'mobile-camera', name: 'Mobile Camera', type: 'camera', visible: true, locked: false, volume: 1, isMuted: false, filters: { brightness: 100, contrast: 100, saturation: 100 } }]} : s));
        };
        pcRef.current = pc;
    };

    const q = query(collection(db, 'scenes'), where('studioId', '==', studioId), orderBy('order', 'asc'));
    const unsubscribeScenes = onSnapshot(q, (snapshot) => {
        // ... keep existing scene logic
        const sceneData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
        })) as any[];
        
        setScenes(sceneData.map(s => ({ ...s, sources: [] })));
        if (!activeSceneId && sceneData.length > 0) {
        setActiveSceneId(sceneData[0].id);
        }
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'scenes');
    });

    return () => {
        unsubscribeScenes();
        socketRef.current?.disconnect();
        pcRef.current?.close();
    };
  }, [studioId]);

  // 3. Sync Scene Items (Simplified for current architecture)
  useEffect(() => {
    if (scenes.length === 0) return;

    const q = query(collection(db, 'sceneItems'), where('sceneId', 'in', scenes.map(s => s.id)));
    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      setScenes(prev => prev.map(scene => ({
        ...scene,
        sources: items
          .filter(item => item.sceneId === scene.id)
          .sort((a, b) => a.order - b.order)
          .map(item => ({
            ...item,
            stream: streams[item.id] // Attach local stream if available
          }))
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sceneItems');
    });

    return () => unsubscribeItems();
  }, [scenes.length, streams]); // Only re-run when scene IDs change or streams mapping updates

  // 4. Sync Recording List
  useEffect(() => {
    if (!studioId) return;
    const q = query(collection(db, 'recordings'), where('studioId', '==', studioId), orderBy('startTime', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecordings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [studioId]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const analyzeScene = async () => {
    setIsAnalyzing(true);
    try {
      const resp = await fetch("/api/analyze-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sceneDescription: `Scene "${activeScene.name}" with sources: ${activeScene.sources.map(s => s.name).join(", ")}` 
        })
      });
      const data = await resp.json();
      setAiAdvice(data.advice);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeComposition = async () => {
    setIsAnalyzing(true);
    try {
      const resp = await fetch("/api/analyze-composition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sources: activeScene.sources.map(s => ({ name: s.name, type: s.type }))
        })
      });
      const data = await resp.json();
      setAiAdvice(data.advice);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const summarizeRecording = async (rec: any) => {
    setIsAnalyzing(true);
    try {
      const resp = await fetch("/api/summarize-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: rec.name,
          metadata: { status: rec.status, type: rec.type }
        })
      });
      const data = await resp.json();
      setAiSummary({ id: rec.id, text: data.summary });
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateScript = async () => {
    setIsAnalyzing(true);
    try {
      const resp = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sceneName: activeScene.name,
          sources: activeScene.sources.map(s => ({ name: s.name, type: s.type }))
        })
      });
      const data = await resp.json();
      setGeneratedScript(data.script);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const smartBuildScene = async () => {
    if (!smartBuildPrompt.trim() || !studioId) return;
    setIsAnalyzing(true);
    try {
      const resp = await fetch("/api/generate-layout-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: smartBuildPrompt })
      });
      const data = await resp.json();
      
      // 1. Create the scene
      const sceneRef = await addDoc(collection(db, 'scenes'), {
        studioId,
        name: data.sceneName || 'Smart AI Scene',
        order: scenes.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Add the items
      for (const src of data.sources) {
        await addDoc(collection(db, 'sceneItems'), {
          sceneId: sceneRef.id,
          name: src.name,
          type: src.type,
          x: src.x,
          y: src.y,
          width: src.width,
          height: src.height,
          visible: true,
          locked: false,
          order: data.sources.indexOf(src),
          filters: { brightness: 100, contrast: 100, saturation: 100 },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setActiveSceneId(sceneRef.id);
      setShowSmartBuild(false);
      setSmartBuildPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const transitionToProgram = () => {
    // In a real studio mode, we'd have a 'Program' scene state
    // For now we simulate the flash/transition
    const program = document.getElementById('program-view');
    if (program) {
      program.classList.add('brightness-150');
      setTimeout(() => program.classList.remove('brightness-150'), 200);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(prev => Math.max(2.1, Math.min(12.5, prev + (Math.random() - 0.5))));
      setBitrate(prev => Math.max(4000, Math.min(5000, prev + (Math.random() - 0.5) * 100)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const addSource = async (type: Source['type'], deviceId?: string, extraData?: any) => {
    try {
      let stream: MediaStream | undefined;
      let url: string | undefined;
      let name = type.charAt(0).toUpperCase() + type.slice(1);

      if (type === 'camera') {
        const constraints: MediaStreamConstraints = deviceId 
          ? { video: { deviceId }, audio: true } 
          : { video: true, audio: true };
        
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaErr) {
          console.warn("Retrying without audio due to error:", mediaErr);
          // Retry without audio if audio permission was denied or device was missing
          const videoOnlyConstraints: MediaStreamConstraints = deviceId 
            ? { video: { deviceId } } 
            : { video: true };
          stream = await navigator.mediaDevices.getUserMedia(videoOnlyConstraints);
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const device = devices.find(d => d.deviceId === deviceId);
        name = device?.label || "Webcam Capture";
        setAvailableDevices(devices.filter(d => d.kind === 'videoinput'));
      } else if (type === 'screen') {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch (screenErr) {
          console.warn("Retrying screen capture without audio:", screenErr);
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
        name = "Display Capture";
      } else if (type === 'droidcam') {
        url = `http://${extraData.ip}:${extraData.port}/video?q=${extraData.quality || 70}`;
        name = `DroidCam (${extraData.ip})`;
      }

      const newSourceData: any = {
        sceneId: activeSceneId,
        name: `${name} ${activeScene.sources.length + 1}`,
        type,
        visible: true,
        locked: false,
        url,
        volume: 0.8,
        isMuted: false,
        filters: { 
          brightness: 100, 
          contrast: 100, 
          saturation: 100,
          chromaKey: { enabled: false, color: '#00ff00', similarity: 30, smoothness: 10 }
        },
        order: activeScene.sources.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'sceneItems'), newSourceData);
      
      if (stream) {
        setStreams(prev => ({ ...prev, [docRef.id]: stream! }));
      }

      setShowAddSource(false);
      setShowAddDevicePicker(false);
      setShowDroidCamInput(false);
    } catch (err: any) {
      console.error("Failed to add source:", err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        alert("Permission Denied: Please click the camera/lock icon in your browser address bar and choose 'Allow' for Camera and Microphone.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert("Device Not Found: Please ensure your camera or screen share is available.");
      } else {
        alert(`Error: ${err.message || "Failed to access media device."}`);
      }
    }
  };

  const refreshDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setAvailableDevices(devices.filter(d => d.kind === 'videoinput'));
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  const discoverDroidCam = async () => {
    setIsScanning(true);
    setDiscoveryLog('Scanning for DroidCam...');
    
    const subnets = ['192.168.1', '192.168.0', '10.0.0', '127.0.0.1'];
    const commonIps = [
      ...Array.from({ length: 20 }, (_, i) => i + 1), // 1-20
      ...[100, 101, 102, 103, 104, 105, 110, 120] // common high IPs
    ];
    const ports = ['4747', '4748', '8080'];
    
    let found = false;
    let checkedCount = 0;
    const totalToPool = subnets.length * commonIps.length;

    // Parallel scan with limit
    for (const subnet of subnets) {
      if (found) break;
      setDiscoveryLog(`Scanning ${subnet}.x network...`);
      
      const chunkSize = 8;
      for (let i = 0; i < commonIps.length; i += chunkSize) {
        if (found) break;
        const chunk = commonIps.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (lastOctet) => {
          if (found) return;
          const ip = subnet === '127.0.0.1' ? 'localhost' : `${subnet}.${lastOctet}`;
          
          for (const port of ports) {
            if (found) return;
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 800);
              await fetch(`http://${ip}:${port}/`, { mode: 'no-cors', signal: controller.signal });
              clearTimeout(timeout);
              setDroidCamIP(ip);
              setDroidCamPort(port);
              setDiscoveryLog(`Signal Detected: ${ip}:${port}`);
              found = true;
              break;
            } catch (e) {
              checkedCount++;
            }
          }
        }));
      }
    }

    if (!found) {
      setDiscoveryLog('No active DroidCam signals found.');
    }
    setIsScanning(false);
  };

  const handleAddSourceClick = (type: Source['type'], extraData?: any) => {
    if (type === 'camera') {
      refreshDevices();
      setSelectedSourceType('camera');
      setShowAddDevicePicker(true);
      setShowAddSource(false);
    } else if (type === 'droidcam') {
      if (extraData && extraData.useVirtual) {
        // Find DroidCam device in available devices
        const droidDevice = availableDevices.find(d => d.label.toLowerCase().includes('droid'));
        if (droidDevice) {
          addSource('camera', droidDevice.deviceId);
          setShowDroidCamInput(false);
          return;
        } else {
          alert("DroidCam Virtual Camera driver not detected. Make sure the DroidCam Client is running on your PC.");
          return;
        }
      }
      setShowDroidCamInput(true);
      setShowAddSource(false);
      discoverDroidCam();
    } else {
      addSource(type);
    }
  };

  const toggleVisibility = async (sourceId: string) => {
    const source = activeScene.sources.find(s => s.id === sourceId);
    if (!source) return;
    try {
      await setDoc(doc(db, 'sceneItems', sourceId), {
        visible: !source.visible,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${sourceId}`);
    }
  };

  const toggleLock = async (sourceId: string) => {
    const source = activeScene.sources.find(s => s.id === sourceId);
    if (!source) return;
    try {
      await setDoc(doc(db, 'sceneItems', sourceId), {
        locked: !source.locked,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${sourceId}`);
    }
  };

  const handleReorderSource = async (sourceId: string, direction: 'up' | 'down') => {
    const currentIndex = activeScene.sources.findIndex(s => s.id === sourceId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= activeScene.sources.length) return;

    const sourceToMove = activeScene.sources[currentIndex];
    const targetSource = activeScene.sources[newIndex];

    try {
      // Swap order values
      await updateDoc(doc(db, 'sceneItems', sourceToMove.id), { order: newIndex });
      await updateDoc(doc(db, 'sceneItems', targetSource.id), { order: currentIndex });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'sceneItems');
    }
  };

  const deleteSource = async (sourceId: string) => {
    try {
      await deleteDoc(doc(db, 'sceneItems', sourceId));
      setStreams(prev => {
        const next = { ...prev };
        delete next[sourceId];
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sceneItems/${sourceId}`);
    }
  };

  const startRecording = async () => {
    chunksRef.current = [];
    
    // Prefer virtual camera canvas if running
    let streamToRecord: MediaStream | null = null;
    
    if (isVirtualCam && virtualCanvasRef.current) {
        streamToRecord = virtualCanvasRef.current.captureStream(30);
    } else {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          streamToRecord = canvas.captureStream(30);
        } else {
          streamToRecord = activeScene.sources.find(s => s.stream)?.stream || null;
        }
    }

    if (!streamToRecord) {
      alert("No active video source to record!");
      return;
    }

    const recorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm;codecs=vp9' });
    
    // Setup Firebase Recording Entry
    let recId = '';
    try {
      const recDoc = await addDoc(collection(db, 'recordings'), {
        studioId,
        name: `Podcast Session ${new Date().toLocaleTimeString()}`,
        startTime: serverTimestamp(),
        status: 'recording',
        createdAt: serverTimestamp()
      });
      recId = recDoc.id;
      setRecordingId(recId);
    } catch (e) {
      console.error("Recording start sync failed", e);
    }

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        
        // Push chunk to cloud immediately (Async)
        if (recId) {
          const index = chunkIndex;
          const blob = e.data;
          setChunkIndex(prev => prev + 1);
          
          fetch(`/api/upload-chunk?recordingId=${recId}&index=${index}`, {
            method: 'POST',
            headers: { 'Content-Type': 'video/webm' },
            body: blob
          }).then(res => res.json())
            .then(data => {
              addDoc(collection(db, 'recordings', recId, 'chunks'), {
                recordingId: recId,
                chunkIndex: index,
                url: data.url,
                size: blob.size,
                createdAt: serverTimestamp()
              });
            });
        }
      }
    };

    recorder.onstop = () => {
      if (recId) {
        updateDoc(doc(db, 'recordings', recId), {
          status: 'completed',
          endTime: serverTimestamp()
        });
      }
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PodSoft-Recording-${Date.now()}.webm`;
      a.click();
    };

    setChunkIndex(0);
    recorderRef.current = recorder;
    
    // Start chunking every 10 minutes (600,000ms)
    recorder.start(600000); 
    setIsRecording(true);
    setSessionState('recording');
  };

  const startScreenRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });

      // Initialize Firestore entry
      let recId = '';
      try {
        const recDoc = await addDoc(collection(db, 'recordings'), {
          studioId,
          name: `Screen Record ${new Date().toLocaleTimeString()}`,
          startTime: serverTimestamp(),
          status: 'recording',
          type: 'screen',
          createdAt: serverTimestamp()
        });
        recId = recDoc.id;
        setScreenRecordingId(recId);
      } catch (e) {
        console.error("Screen recording sync failed", e);
      }

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];
      let localChunkIndex = 0;
      
      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          
          if (recId) {
            const index = localChunkIndex++;
            const blob = e.data;
            
            // Log to server proxy
            try {
              const resp = await fetch(`/api/upload-chunk?recordingId=${recId}&index=${index}`, {
                method: 'POST',
                headers: { 'Content-Type': 'video/webm' },
                body: blob
              });
              const data = await resp.json();
              
              // Record chunk metadata in Firestore
              await addDoc(collection(db, 'recordings', recId, 'chunks'), {
                recordingId: recId,
                chunkIndex: index,
                url: data.url,
                size: blob.size,
                createdAt: serverTimestamp()
              });
            } catch (err) {
              console.error("Chunk upload failed", err);
            }
          }
        }
      };

      recorder.onstop = async () => {
        if (recId) {
          try {
            await updateDoc(doc(db, 'recordings', recId), {
              status: 'completed',
              endTime: serverTimestamp()
            });
          } catch (e) {
            console.error("Finalize recording failed", e);
          }
        }

        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Screen-Record-${Date.now()}.webm`;
        a.click();
        
        // Cleanup stream
        stream.getTracks().forEach(track => track.stop());
        setScreenRecordingId(null);
      };
      
      // Start with 10s chunks for cloud sync
      recorder.start(10000); 
      screenRecorderRef.current = recorder;
      setIsScreenRecording(true);
      setSessionState('recording');
    } catch (err) {
      console.error("Screen recording failed", err);
      setIsScreenRecording(false);
      setSessionState('failed');
    }
  };

  const stopScreenRecording = () => {
    screenRecorderRef.current?.stop();
    setIsScreenRecording(false);
    setSessionState('stopped');
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
    setSessionState('stopped');
    setRecordingId(null);
  };

  const getTransitionVariants = () => {
    const duration = transitionDuration / 1000;
    
    switch (transitionType) {
      case 'Cut':
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 1 },
          transition: { duration: 0 }
        };
      case 'Swipe':
        return {
          initial: { x: '100%' },
          animate: { x: 0 },
          exit: { x: '-100%' },
          transition: { duration, ease: "easeInOut" }
        };
      case 'Slide':
        return {
          initial: { x: '100%', opacity: 1 },
          animate: { x: 0, opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration, ease: "easeOut" }
        };
      case 'Fade':
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration }
        };
    }
  };

  const variants = getTransitionVariants();

  return (
    <div className="h-screen w-screen flex flex-col bg-obs-bg select-none text-obs-text overflow-hidden">
      {/* Menu Bar */}
      <div id="layout-menu-bar" className="flex items-center gap-4 px-2 py-0 border-b border-obs-border bg-obs-surface text-[11px] font-medium text-white/70">
        <div id="app-logo" className="flex items-center gap-1.5 pr-4 border-r border-obs-border py-1">
           <div className="bg-blue-600 p-0.5 rounded-sm shadow-[0_0_8px_rgba(37,99,235,0.5)]">
             <Video size={14} className="text-white" strokeWidth={3} />
           </div>
           <span className="font-bold tracking-tighter text-white text-[13px]">PODSOFT</span>
        </div>
        <span onClick={() => setCurrentView('file')} className="hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-white/5">File</span>
        <span onClick={() => setCurrentView('edit')} className="hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-white/5">Edit</span>
        <span onClick={() => setCurrentView('view')} className="hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-white/5">View</span>
        <span onClick={() => setCurrentView('profile')} className="hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-white/5">Profile</span>
        <div className="h-3 w-px bg-obs-border mx-1" />
        <span className="text-blue-400 font-bold">PodSoft Studio v1.2</span>
        <div className="ml-auto text-obs-text-dim pr-2 flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-2">
              <img src={user.photoURL || undefined} alt="" className="w-5 h-5 rounded-full border border-white/10" />
              <span className="text-white font-bold">{user.displayName}</span>
              <button onClick={logout} className="hover:text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                <LogOut size={10} /> Logout
              </button>
            </div>
          ) : (
            <button onClick={login} className="text-white font-bold flex items-center gap-1 bg-blue-600 px-3 py-1 rounded shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-all">
              <LogIn size={12} /> Sign In
            </button>
          )}
          <div className="h-4 w-px bg-obs-border mx-1" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px]">ENGINE: ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Auth Screen Overlay */}
      {!user && !authLoading && (
        <div className="flex-1 flex flex-col items-center justify-center bg-obs-bg/60 backdrop-blur-md z-[500] relative p-6">
          <div className="bg-obs-surface p-8 md:p-12 rounded-2xl border border-obs-border shadow-2xl flex flex-col items-center gap-6 max-w-md w-full text-center">
             <div className="bg-blue-600 p-4 rounded-3xl shadow-[0_0_40px_rgba(37,99,235,0.4)]">
               <Video size={48} className="text-white" strokeWidth={2.5} />
             </div>
             <div className="flex flex-col gap-1">
               <h1 className="text-3xl font-black italic tracking-tighter text-white">PODSOFT STUDIO</h1>
               <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Broadcast Engine v1.2</p>
             </div>

             {authMode === 'google' ? (
               <div className="flex flex-col gap-4 w-full">
                 <button 
                   onClick={login}
                   className="w-full flex items-center justify-center gap-3 bg-white text-black font-black py-4 rounded-xl hover:bg-zinc-200 transition-all transform active:scale-95 shadow-xl"
                 >
                   <LogIn size={20} />
                   CONTINUE WITH GOOGLE
                 </button>
                 <div className="flex items-center gap-4 my-2">
                   <div className="h-px bg-obs-border flex-1" />
                   <span className="text-[10px] font-bold text-obs-text-dim uppercase">OR</span>
                   <div className="h-px bg-obs-border flex-1" />
                 </div>
                 <button 
                   onClick={() => setAuthMode('signin')}
                   className="text-xs font-bold text-obs-text-dim hover:text-white transition-colors"
                 >
                   Use email and password
                 </button>
               </div>
             ) : (
               <form 
                 onSubmit={async (e) => {
                   e.preventDefault();
                   setAuthError(null);
                   setIsSubmitting(true);
                   try {
                     if (authMode === 'signin') {
                       await loginWithEmail(email, password);
                     } else {
                       await signup(email, password);
                     }
                   } catch (err: any) {
                     setAuthError(err.message || 'Authentication failed');
                   } finally {
                     setIsSubmitting(false);
                   }
                 }}
                 className="flex flex-col gap-4 w-full"
               >
                 <div className="flex flex-col gap-1 text-left">
                   <label className="text-[10px] font-black text-obs-text-dim uppercase tracking-wider ml-1">Email Address</label>
                   <input 
                     type="email" 
                     required
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     className="bg-obs-bg border border-obs-border p-3 rounded-lg text-white text-sm focus:border-blue-500 outline-none transition-all"
                     placeholder="studio@podsoft.pro"
                   />
                 </div>
                 <div className="flex flex-col gap-1 text-left">
                   <label className="text-[10px] font-black text-obs-text-dim uppercase tracking-wider ml-1">Password</label>
                   <input 
                     type="password" 
                     required
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="bg-obs-bg border border-obs-border p-3 rounded-lg text-white text-sm focus:border-blue-500 outline-none transition-all"
                     placeholder="••••••••"
                   />
                 </div>

                  {authError && (
                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-left">
                      <p className="text-red-400 text-[10px] font-bold uppercase leading-tight tracking-tight">{authError}</p>
                    </div>
                  )}

                 <button 
                   type="submit"
                   disabled={isSubmitting}
                   className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-500 transition-all transform active:scale-95 shadow-xl disabled:opacity-50"
                 >
                   {isSubmitting ? 'PROCESSING...' : authMode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                 </button>

                 <button 
                   type="button"
                   onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                   className="text-xs font-bold text-obs-text-dim hover:text-white transition-colors"
                 >
                   {authMode === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                 </button>

                 <button 
                    type="button"
                    onClick={() => {
                      setAuthMode('google');
                      setAuthError(null);
                    }}
                    className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest mt-2"
                 >
                   ← BACK TO GOOGLE LOGIN
                 </button>
               </form>
             )}
             
             <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] italic">Pro-Grade Persistence Enabled</p>
          </div>
        </div>
      )}

      {authLoading && (
         <div className="flex-1 flex flex-col items-center justify-center bg-obs-bg">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <span className="mt-4 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Calibrating Signal</span>
         </div>
      )}

      {/* Main Content */}
      {user && (
        <>
          {/* Internal Projector Overlay */}
      <AnimatePresence>
        {showInternalProjector && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="absolute top-4 right-4 flex gap-4 z-10">
               <button onClick={() => setShowInternalProjector(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md">
                 <X size={24} />
               </button>
            </div>
            <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest text-white animate-pulse">Program Projector Active</div>
            
            <div className="w-full h-full flex items-center justify-center p-8">
               <video 
                 autoPlay 
                 playsInline 
                 muted 
                 className="max-w-full max-h-full shadow-2xl border border-white/5 rounded-lg bg-black"
                 ref={el => {
                   if (el && virtualStreamRef.current) el.srcObject = virtualStreamRef.current;
                 }}
               />
            </div>
            
            <div className="absolute bottom-8 px-6 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Escape to exit projector mode
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Settings Overlay */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 20 }}
               className="bg-obs-surface border border-obs-border rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
             >
                <div className="p-6 border-b border-obs-border flex justify-between items-center bg-obs-bg/50">
                   <div className="flex items-center gap-3">
                      <Settings className="text-zinc-400" />
                      <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">System Configuration</h2>
                   </div>
                   <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-lg"><X/></button>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                   <div className="w-48 bg-black/20 border-r border-obs-border p-4 flex flex-col gap-1">
                      {['General', 'Stream', 'Output', 'Audio', 'Video', 'Hotkeys'].map(tab => (
                        <button 
                          key={tab}
                          onClick={() => setSelectedSettingsTab(tab)}
                          className={`w-full text-left px-4 py-2 rounded text-xs font-black uppercase tracking-widest transition-all ${selectedSettingsTab === tab ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                        >
                          {tab}
                        </button>
                      ))}
                   </div>
                   
                   <div className="flex-1 overflow-auto p-8 bg-obs-bg/30">
                      {selectedSettingsTab === 'General' && (
                        <div className="flex flex-col gap-8">
                           <section>
                              <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] mb-4">Application Environment</h3>
                              <div className="grid gap-4">
                                 <SettingRow label="Studio Mode" description="Enables preview/program layout for professional switches." enabled={studioMode} onToggle={() => setStudioMode(!studioMode)} />
                                 <SettingRow label="Hardware Acceleration" description="Use GPU for video processing (experimental)." enabled={true} />
                                 <SettingRow label="Auto-Record on Start" description="Automatically start recording when streaming begins." />
                              </div>
                           </section>
                        </div>
                      )}
                      
                      {selectedSettingsTab === 'Video' && (
                        <div className="flex flex-col gap-8">
                           <section>
                              <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] mb-4">Canvas Dimensions</h3>
                              <div className="grid gap-6">
                                 <SelectRow label="Base (Canvas) Resolution" options={['1920x1080', '1280x720', '1080x1920']} value={baseResolution} onChange={setBaseResolution} />
                                 <SelectRow label="Output (Scaled) Resolution" options={['1920x1080', '1280x720', '720x480']} value={outputResolution} onChange={setOutputResolution} />
                                 <SelectRow label="Common FPS Values" options={['60', '30', '24']} value={fpsValue.toString()} onChange={v => setFpsValue(parseInt(v))} />
                              </div>
                           </section>
                        </div>
                      )}
                      
                      {selectedSettingsTab === 'Stream' && (
                        <div className="flex flex-col items-center justify-center p-20 text-center gap-4 text-zinc-500">
                           <Radio size={48} strokeWidth={1} />
                           <p className="font-bold text-sm">Streaming services are currently managed via PodSync Cloud.</p>
                        </div>
                      )}
                   </div>
                </div>
                
                <div className="p-4 bg-obs-bg border-t border-obs-border flex justify-end gap-3">
                   <button onClick={() => setShowSettings(false)} className="px-6 py-2 rounded-lg text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors">Cancel</button>
                   <button onClick={() => setShowSettings(false)} className="px-6 py-2 bg-blue-600 rounded-lg text-[10px] font-black uppercase text-white shadow-lg hover:bg-blue-500 transition-colors">Save & Apply</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Navigation Overlays */}
        <AnimatePresence>
          {currentView !== 'studio' && (
            <motion.div 
              initial={{ opacity: 0, x: isMobile ? '100%' : 0, scale: isMobile ? 1 : 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: isMobile ? '100%' : 0, scale: isMobile ? 1 : 0.95 }}
              className={`absolute inset-0 bg-obs-bg z-[400] flex flex-col overflow-hidden ${isMobile ? '' : 'inset-x-4 top-10 bottom-12 rounded-xl border border-obs-border shadow-2xl'}`}
            >
              <div className="bg-obs-surface p-4 border-b border-obs-border flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  {currentView === 'file' && <FolderOpen size={20} className="text-blue-400" />}
                  {currentView === 'edit' && <Layout size={20} className="text-purple-400" />}
                  {currentView === 'view' && <Maximize2 size={20} className="text-green-400" />}
                  {currentView === 'profile' && <UserIcon size={20} className="text-orange-400" />}
                  {currentView === 'drive' && <FolderOpen size={20} className="text-green-500" />}
                  <div className="flex flex-col">
                    <span className="font-black italic uppercase tracking-wider text-white text-sm">{currentView}</span>
                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{currentView === 'edit' ? 'Production Assets' : 'System Module'}</span>
                  </div>
                </div>
                <button onClick={() => setCurrentView('studio')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto bg-obs-bg/95">
                {currentView === 'file' && <FilePage recordings={recordings} studioId={studioId} onSummarize={summarizeRecording} isAnalyzing={isAnalyzing} aiSummary={aiSummary} />}
                {currentView === 'edit' && <EditorPage activeScene={activeScene} studioId={studioId} onOptimize={analyzeComposition} onGenerateScript={generateScript} generatedScript={generatedScript} setGeneratedScript={setGeneratedScript} isAnalyzing={isAnalyzing} />}
                {currentView === 'profile' && <ProfilePage user={user} logout={logout} recordings={recordings} scenes={scenes} />}
                {currentView === 'drive' && <DriveView />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isMobile && currentView === 'studio' && (
          <div className="flex-1 flex flex-col">
            <div className="h-64 bg-black relative shrink-0">
               {/* Mobile Preview */}
               <div className="absolute inset-0 z-0">
                 {/* Similar to program-view rendering */}
                 {activeScene.sources.map(s => s.visible && (
                   <div key={s.id} className="absolute inset-0 bg-black">
                     <SourceVideo {...s} type={s.type} locked={true} />
                   </div>
                 )).slice(0, 1)} {/* Show top source as preview on mobile */}
               </div>
               <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 rounded text-[8px] font-black uppercase text-white animate-pulse">LIVE PREVIEW</div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
               <div className="flex items-center justify-between border-b border-obs-border pb-2">
                 <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Control Center</h2>
                 <div className="flex gap-2">
                   <button onClick={() => setShowAddSource(true)} className="p-2 bg-blue-600 rounded-lg"><Plus size={16}/></button>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-2">
                 <ControlButton 
                   active={isRecording} 
                   onClick={isRecording ? stopRecording : startRecording}
                   label={isRecording ? "REC" : "REC"}
                   activeColor="bg-red-600"
                   className="h-12 text-[10px]"
                 />
                 <ControlButton 
                   active={isScreenRecording} 
                   onClick={isScreenRecording ? stopScreenRecording : startScreenRecording}
                   label={isScreenRecording ? "SCR" : "SCR"}
                   activeColor="bg-orange-600"
                   className="h-12 text-[10px]"
                 />
                 <ControlButton 
                   active={isVirtualCam} 
                   onClick={isVirtualCam ? stopVirtualCam : startVirtualCam}
                   label={isVirtualCam ? "V-CAM" : "V-CAM"}
                   activeColor="bg-sky-600"
                   className="h-12 text-[10px]"
                 />
                 <ControlButton 
                   onClick={openProjector}
                   label="PROJ"
                   className="h-12 text-[10px] bg-indigo-900/40"
                 />
               </div>

               <div className="bg-obs-surface p-4 rounded-xl border border-obs-border">
                  <span className="text-[10px] font-black text-obs-text-dim uppercase mb-3 block">Timeline Feed</span>
                  <div className="flex flex-col gap-2">
                    {activeScene.sources.map(src => (
                      <div key={src.id} className="flex items-center gap-3 bg-obs-bg p-2 rounded-lg border border-white/5">
                         <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">
                            {src.type === 'camera' && <Camera size={16}/>}
                            {src.type === 'droidcam' && <Video size={16}/>}
                            {src.type === 'screen' && <Monitor size={16}/>}
                         </div>
                         <div className="flex-1">
                            <p className="text-[10px] font-bold text-white">{src.name}</p>
                            <p className="text-[8px] text-zinc-500 uppercase">{src.type}</p>
                         </div>
                         <button onClick={() => toggleVisibility(src.id)} className={src.visible ? 'text-blue-500' : 'text-zinc-600'}>
                           {src.visible ? <Eye size={16}/> : <EyeOff size={16}/>}
                         </button>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="h-16 bg-obs-surface border-t border-obs-border flex items-center justify-around px-4">
               <NavBtn icon={<Layout size={20}/>} label="Studio" active={currentView === 'studio'} onClick={() => setCurrentView('studio')} />
               <NavBtn icon={<FolderOpen size={20}/>} label="Files" active={currentView === 'file'} onClick={() => setCurrentView('file')} />
               <NavBtn icon={<Database size={20}/>} label="Drive" active={currentView === 'drive'} onClick={() => setCurrentView('drive')} />
               <NavBtn icon={<Activity size={20}/>} label="Edit" active={currentView === 'edit'} onClick={() => setCurrentView('edit')} />
               <NavBtn icon={<UserIcon size={20}/>} label="Profile" active={currentView === 'profile'} onClick={() => setCurrentView('profile')} />
            </div>
          </div>
        )}

        {!isMobile && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 bg-black/40 p-4 flex gap-4 overflow-hidden justify-center items-center relative">
          
            {studioMode && (
            <div className="flex-1 max-w-[45%] h-full flex flex-col gap-2">
              <div className="text-[10px] uppercase font-bold text-obs-text-dim text-center">Preview</div>
              
              {/* Source Selection for Preview */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {Array.from(new Map(scenes.flatMap(s => s.sources).map(s => [s.id, s])).values()).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedPreviewSourceId(s.id)}
                    className={`text-[9px] px-2 py-1 rounded ${selectedPreviewSourceId === s.id ? 'bg-blue-600 text-white' : 'bg-obs-surface text-obs-text-dim hover:text-white'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              <div className="flex-1 bg-black border border-obs-border relative overflow-hidden">
              {/* All sources across scenes */}
              {(() => {
                const allSources = Array.from(new Map(scenes.flatMap(s => s.sources).map(s => [s.id, s])).values());
                const previewSourceId = selectedPreviewSourceId || allSources[0]?.id;
                const source = allSources.find(s => s.id === previewSourceId);
                return source ? (
                     <div
                      key={source.id}
                      className="absolute inset-0"
                    >
                      <SourceVideo 
                        id={source.id}
                        stream={streams[source.id] || source.stream} 
                        url={source.url} 
                        locked={source.locked} 
                        filters={source.filters} 
                        type={source.type}
                        volume={source.volume}
                        isMuted={source.isMuted}
                      />
                    </div>
                ) : null;
              })()}
              </div>
            </div>
          )}

          {studioMode && (
            <div className="flex flex-col gap-2 z-50">
              <button 
                onClick={() => {
                  setTransitionType('Cut');
                  transitionToProgram();
                }}
                className={`obs-button-primary py-4 px-6 font-black italic hover:scale-105 active:scale-95 shadow-xl ${transitionType === 'Cut' ? 'bg-blue-600' : ''}`}
              >
                CUT
              </button>
              <button 
                onClick={() => {
                  if (transitionType === 'Cut') setTransitionType('Fade');
                  transitionToProgram();
                }}
                className={`obs-button py-4 px-6 font-black italic hover:scale-105 active:scale-95 ${transitionType !== 'Cut' ? 'bg-blue-700/50 border-blue-500' : ''}`}
              >
                TRANSITION
              </button>
            </div>
          )}

          <div className={`flex-1 ${studioMode ? 'max-w-[45%]' : 'max-w-5xl'} h-full flex flex-col gap-2`}>
            {studioMode && <div className="text-[10px] uppercase font-bold text-red-500 text-center flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Program
            </div>}
            <div id="program-view" className="flex-1 bg-black shadow-2xl relative border-2 border-obs-border group cursor-crosshair overflow-hidden transition-all duration-300">
              {/* Canvas Rendering Area */}
              <div className="absolute inset-0">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={activeSceneId}
                    initial={variants.initial}
                    animate={variants.animate}
                    exit={variants.exit}
                    transition={variants.transition}
                    className="absolute inset-0"
                  >
                    {activeScene.sources.length === 0 && (
                      <div className="h-full w-full flex flex-col items-center justify-center text-obs-text-dim gap-4 bg-zinc-900/50">
                        <Radio size={48} className="opacity-20" />
                        <p className="text-sm opacity-40">No sources active. Use '+' in Sources panel.</p>
                      </div>
                    )}
                    
                    {activeScene.sources.map((source, index) => (
                      source.visible && (
                        <motion.div
                          key={source.id}
                          drag={!source.locked}
                          data-container-id={source.id}
                          dragMomentum={false}
                          onDragEnd={async (_, info) => {
                            if (source.locked) return;
                            try {
                              // We need to calculate relative position or just store x/y
                              // For simplicity, we'll store the delta or absolute offset if we had container ref
                              // Since we use relative layout, let's just stick to what we have 
                              // or skip absolute pos for this demo since it's complex without container bounds
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedSourceId(source.id); }}
                          className={`absolute p-0.5 border-2 ${selectedSourceId === source.id ? 'border-blue-500 z-50' : source.locked ? 'border-transparent' : 'border-red-600/50 hover:border-red-500'} cursor-move`}
                          style={{ 
                            width: source.type === 'camera' ? '40%' : '100%', 
                            height: source.type === 'camera' ? '40%' : '100%',
                            top: index * 20,
                            left: index * 20,
                            zIndex: activeScene.sources.length - index
                          }}
                        >
                          <div className="w-full h-full bg-black relative flex items-center justify-center">
                            <SourceVideo 
                              id={source.id}
                              stream={source.stream} 
                              url={source.url} 
                              locked={source.locked} 
                              filters={source.filters} 
                              type={source.type}
                              volume={source.volume}
                              isMuted={source.isMuted}
                              onVolumeChange={async (vol, muted) => {
                                try {
                                  await setDoc(doc(db, 'sceneItems', source.id), {
                                    volume: vol,
                                    isMuted: muted,
                                    updatedAt: serverTimestamp()
                                  }, { merge: true });
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${source.id}`);
                                }
                              }}
                            />
                            {!source.stream && !source.url && (
                              <div className="flex flex-col items-center gap-2 opacity-30">
                                {source.type === 'image' && <ImageIcon size={32} />}
                                {source.type === 'text' && <Type size={32} />}
                                <span className="text-[10px] font-mono">{source.name}</span>
                              </div>
                            )}
                            <div className="absolute top-1 left-1 px-1 bg-black/60 text-[8px] uppercase tracking-tighter border border-white/5">
                              {source.name}
                            </div>
                          </div>
                        </motion.div>
                      )
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Viewport Overlay */}
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 rounded text-[10px] font-mono border border-white/10 uppercase z-50 text-white/50">
                {isStreaming ? <span className="text-red-500">Live</span> : "Preview"}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Docks Area */}
        <div className="h-64 min-h-[256px] border-t border-obs-border bg-obs-bg grid grid-cols-12 gap-1 p-1 overflow-hidden shadow-[inner_0_4px_10px_rgba(0,0,0,0.5)]">
          
          {/* Scenes Dock */}
          <Dock title="Scenes" className="col-span-2">
            <div className="flex flex-col gap-0.5 h-full relative">
              <AnimatePresence>
                {showSmartBuild && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-0 z-50 bg-obs-surface border border-purple-500/30 p-4 flex flex-col gap-3 shadow-2xl rounded-sm"
                  >
                    <div className="flex justify-between items-center bg-purple-500/10 -mx-4 -mt-4 p-2 px-4 mb-2">
                      <span className="text-[10px] font-black uppercase text-purple-400 flex items-center gap-2">
                        <Sparkles size={12} /> Smart Build
                      </span>
                      <button onClick={() => setShowSmartBuild(false)} className="text-zinc-500 hover:text-white"><Plus className="rotate-45" size={12}/></button>
                    </div>
                    <textarea 
                      placeholder="Describe your scene... e.g. 'Professional podcast layout with 2 cameras and a logo lower third'"
                      className="flex-1 bg-obs-bg border border-obs-border p-2 text-[10px] rounded outline-none focus:border-purple-500 transition-colors resize-none text-white italic"
                      value={smartBuildPrompt}
                      onChange={(e) => setSmartBuildPrompt(e.target.value)}
                    />
                    <button 
                      onClick={smartBuildScene}
                      disabled={isAnalyzing || !smartBuildPrompt.trim()}
                      className="bg-purple-600 hover:bg-purple-500 py-1.5 rounded text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                    >
                      {isAnalyzing ? 'Building...' : 'Execute AI Build'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-auto bg-black/20 rounded-sm">
                {scenes.map(s => (
                  <div 
                    key={s.id}
                    onClick={() => setActiveSceneId(s.id)}
                    className={`px-2 py-1 text-xs cursor-pointer rounded-sm transition-colors flex items-center justify-between group ${activeSceneId === s.id ? 'bg-blue-700 text-white font-semibold' : 'hover:bg-white/5 text-obs-text-dim'}`}
                  >
                    <span>{s.name}</span>
                    {activeSceneId === s.id && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                  </div>
                ))}
              </div>
              <div className="pt-1 flex gap-2 border-t border-obs-border text-obs-text-dim bg-obs-surface/50 -mx-1 px-2">
                <Plus size={14} className="hover:text-white cursor-pointer" onClick={async () => {
                  try {
                    await addDoc(collection(db, 'scenes'), {
                      studioId,
                      name: `Scene ${scenes.length + 1}`,
                      order: scenes.length,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp()
                    });
                  } catch (error) {
                    handleFirestoreError(error, OperationType.CREATE, 'scenes');
                  }
                }} />
                <Sparkles 
                  size={14} 
                  className={`hover:text-purple-400 cursor-pointer ${showSmartBuild ? 'text-purple-400' : ''} transition-colors`} 
                  onClick={() => setShowSmartBuild(!showSmartBuild)} 
                />
                <Trash2 size={14} className="hover:text-white cursor-pointer" onClick={async () => {
                  if (scenes.length > 1) {
                    try {
                      await deleteDoc(doc(db, 'scenes', activeSceneId));
                      // Note: We should ideally also delete sceneItems, but for this demo doc deletion is fine
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, `scenes/${activeSceneId}`);
                    }
                  }
                }} />
                <div className="ml-auto flex gap-2">
                  <ChevronUp size={14} className="hover:text-white cursor-pointer" />
                  <ChevronDown size={14} className="hover:text-white cursor-pointer" />
                </div>
              </div>
            </div>
          </Dock>

          {/* Sources Dock */}
          <Dock id="dock-sources" title="Sources" className="col-span-3 relative">
            <AnimatePresence>
              {showAddSource && (
                <motion.div 
                  id="source-add-popup"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-10 left-2 right-2 bg-obs-surface border border-obs-border p-2 z-[60] shadow-2xl rounded"
                >
                  <div className="text-[10px] uppercase font-bold text-obs-text-dim mb-2 border-b border-obs-border pb-1">Add Source</div>
                  <div className="grid grid-cols-2 gap-1">
                    <SourceAddBtn icon={<Camera size={12}/>} label="Camera" onClick={() => handleAddSourceClick('camera')} />
                    <SourceAddBtn icon={<Monitor size={12}/>} label="Display" onClick={() => handleAddSourceClick('screen')} />
                    <SourceAddBtn icon={<Video size={12}/>} label="DroidCam" onClick={() => handleAddSourceClick('droidcam')} />
                    <SourceAddBtn icon={<ImageIcon size={12}/>} label="Image" onClick={() => handleAddSourceClick('image')} />
                    <SourceAddBtn icon={<Type size={12}/>} label="Text" onClick={() => handleAddSourceClick('text')} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showDevicePicker && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 m-auto w-80 h-fit bg-obs-surface border border-obs-border p-4 z-[100] shadow-2xl rounded flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center border-b border-obs-border pb-2">
                     <span className="text-xs font-bold uppercase tracking-widest">Select Device</span>
                     <button onClick={() => setShowAddDevicePicker(false)} className="hover:text-white"><Plus size={14} className="rotate-45" /></button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-60 overflow-auto">
                    {availableDevices.length === 0 && <span className="text-[10px] text-zinc-500 italic">No devices found. Ensure permissions are granted.</span>}
                    {availableDevices.map(device => (
                      <button 
                        key={device.deviceId}
                        onClick={() => addSource('camera', device.deviceId)}
                        className="text-left py-2 px-3 bg-obs-bg hover:bg-blue-600 rounded text-[11px] transition-colors flex items-center justify-between group"
                      >
                        <span className="truncate">{device.label || `Camera ${device.deviceId.slice(0, 4)}`}</span>
                        {device.label.toLowerCase().includes('droid') && <span className="text-[8px] bg-green-600 px-1 rounded text-white font-bold animate-pulse">DROID</span>}
                      </button>
                    ))}
                  </div>
                  <ControlButton label="Cancel" onClick={() => setShowAddDevicePicker(false)} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showDroidCamInput && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 m-auto w-80 h-fit max-h-[90vh] bg-obs-surface border border-obs-border p-5 z-[100] shadow-2xl rounded flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center border-b border-obs-border pb-2">
                     <span className="text-xs font-bold uppercase tracking-widest text-green-400 font-mono flex items-center gap-2">
                       <Video size={14} /> DroidCam Connection
                     </span>
                     <button onClick={() => setShowDroidCamInput(false)} className="hover:text-white"><Plus size={14} className="rotate-45" /></button>
                  </div>
                  <div className="flex flex-col items-center gap-2 bg-zinc-900 p-3 rounded">
                    <QRCodeSVG value={`podsoft:${studioId}`} size={160} />
                    <p className="text-[9px] text-zinc-400 text-center">Scan to connect mobile device</p>
                  </div>
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    <div className="bg-green-900/20 border border-green-500/30 p-2.5 rounded text-[10px] text-green-200 leading-snug">
                       <p className="font-bold border-b border-green-500/20 mb-1 pb-1">METHOD 1: DROIDCAM CLIENT (Recommended)</p>
                       If you have the DroidCam app installed on your PC, click below to use the low-latency virtual driver.
                       <button 
                         onClick={() => handleAddSourceClick('droidcam', { useVirtual: true })}
                         className="flex items-center justify-center gap-2 w-full mt-2 bg-green-600 hover:bg-green-500 py-1.5 rounded text-white font-black italic text-[9px] uppercase shadow-lg shadow-green-900/20"
                       >
                         DETECT VIRTUAL CAMERA
                       </button>
                    </div>

                    <div className="bg-zinc-800/50 border border-white/5 p-2.5 rounded text-[10px] text-zinc-300 leading-snug">
                      <div className="flex items-center justify-between border-b border-white/10 mb-2 pb-1">
                        <span className="font-bold text-obs-text-dim uppercase tracking-tighter">METHOD 2: DIRECT IP (Browser Client)</span>
                        <button 
                          onClick={discoverDroidCam} 
                          disabled={isScanning}
                          className={`text-[8px] font-black px-1.5 py-0.5 rounded transition-all ${isScanning ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-400 hover:text-white bg-white/5'}`}
                        >
                          {isScanning ? 'SCANNING...' : 'AUTO-SCAN'}
                        </button>
                      </div>
                      
                      {discoveryLog && (
                        <div className={`mb-3 py-1.5 px-2 rounded border font-mono flex items-center gap-2 ${isScanning ? 'bg-blue-500/5 border-blue-500/20 text-blue-300' : discoveryLog.includes('Detected') ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-black/40 border-white/5 text-zinc-400'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-blue-500 animate-pulse' : discoveryLog.includes('Detected') ? 'bg-green-500' : 'bg-zinc-500'}`} />
                          <span className="text-[8px] uppercase tracking-tighter truncate flex-1">{discoveryLog}</span>
                        </div>
                      )}

                      Enter your phone's IP and Port if not using the PC app. Note: Browsers may block this on HTTPS sites.
                      
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase font-bold text-obs-text-dim">Device IP</label>
                          <input 
                            type="text" 
                            value={droidCamIP} 
                            onChange={(e) => setDroidCamIP(e.target.value)}
                            className={`bg-obs-bg p-2 text-sm border rounded focus:border-green-500 outline-none font-mono transition-colors ${isLocalIP(`http://${droidCamIP}`) ? 'border-amber-500/50' : 'border-obs-border'}`}
                            placeholder="192.168.1.XX"
                          />
                          {isLocalIP(`http://${droidCamIP}`) && (
                            <p className="text-[7px] text-amber-500 font-bold uppercase mt-1">
                              ⚠️ Local IP Detected: Use Ngrok for Cloud Access
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase font-bold text-obs-text-dim">WiFi Port</label>
                          <input 
                            type="text" 
                            value={droidCamPort} 
                            onChange={(e) => setDroidCamPort(e.target.value)}
                            className="bg-obs-bg p-2 text-sm border border-obs-border rounded focus:border-green-500 outline-none font-mono"
                            placeholder="4747"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] uppercase font-bold text-obs-text-dim">Stream Quality</label>
                            <span className="text-[9px] font-mono font-bold text-blue-400">{droidCamQuality}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="1" 
                            max="100" 
                            value={droidCamQuality} 
                            onChange={(e) => setDroidCamQuality(parseInt(e.target.value))}
                            className="w-full accent-green-500 bg-obs-bg h-1 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-[7px] text-obs-text-dim uppercase font-bold mt-0.5">
                            <span>Latency</span>
                            <span>Quality</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => addSource('droidcam', undefined, { ip: droidCamIP, port: droidCamPort, quality: droidCamQuality })}
                          className="bg-zinc-700 hover:bg-zinc-600 py-2 rounded text-[10px] font-bold uppercase tracking-widest text-white transition-all mt-1"
                        >
                          CONNECT IP STREAM
                        </button>
                      </div>
                    </div>
                    
                    <button onClick={() => setShowDroidCamInput(false)} className="text-[10px] text-obs-text-dim hover:text-white uppercase font-bold py-1">Cancel</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-0.5 h-full">
              <div className="flex-1 overflow-auto bg-black/20 rounded-sm">
                {activeScene.sources.map(src => (
                  <div 
                    key={src.id}
                    className="px-2 py-1 text-xs flex items-center gap-2 hover:bg-white/5 cursor-pointer rounded-sm group text-obs-text-dim"
                  >
                    <button onClick={(e) => { e.stopPropagation(); toggleVisibility(src.id); }}>
                      {src.visible ? <Eye size={12} className="text-obs-text" /> : <EyeOff size={12} className="text-zinc-600" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleLock(src.id); }}>
                      {src.locked ? <Lock size={12} className="text-zinc-600" /> : <div className="w-3" />}
                    </button>
                    <span className="flex-1 group-hover:text-white truncate">{src.name}</span>
                    <div className="hidden group-hover:flex gap-1 items-center">
                      <Settings size={10} className="hover:text-white" />
                      <Trash2 size={10} className="text-red-500/50 hover:text-red-500" onClick={(e) => { e.stopPropagation(); deleteSource(src.id); }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-1 flex gap-2 border-t border-obs-border text-obs-text-dim bg-obs-surface/50 -mx-1 px-2 group">
                <Plus size={14} className={`hover:text-white cursor-pointer ${showAddSource ? 'text-white rotate-45 border border-white/20 rounded-full' : ''} transition-all`} onClick={() => setShowAddSource(!showAddSource)} />
                <Trash2 size={14} className="hover:text-white cursor-pointer" />
                <Settings 
                  size={14} 
                  className={`hover:text-white cursor-pointer ml-1 ${selectedSourceId ? 'text-white pulse shadow-blue-500 shadow-sm' : 'opacity-20 pointer-events-none'}`} 
                  onClick={() => setShowProperties(true)}
                />
                <div className="ml-auto flex gap-2">
                  <ChevronUp 
                    size={14} 
                    className={`hover:text-white cursor-pointer ${selectedSourceId ? '' : 'opacity-20 pointer-events-none'}`} 
                    onClick={() => selectedSourceId && handleReorderSource(selectedSourceId, 'up')}
                  />
                  <ChevronDown 
                    size={14} 
                    className={`hover:text-white cursor-pointer ${selectedSourceId ? '' : 'opacity-20 pointer-events-none'}`} 
                    onClick={() => selectedSourceId && handleReorderSource(selectedSourceId, 'down')}
                  />
                </div>
              </div>
            </div>
          </Dock>

          <AnimatePresence>
            {showProperties && selectedSourceId && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="fixed right-4 bottom-72 w-64 bg-obs-surface border border-obs-border p-3 z-[110] shadow-2xl rounded"
              >
                <div className="flex justify-between items-center border-b border-obs-border pb-2 mb-3">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Properties: {activeScene.sources.find(s => s.id === selectedSourceId)?.name}</span>
                   <button onClick={() => setShowProperties(false)} className="hover:text-white"><Plus size={12} className="rotate-45" /></button>
                </div>
                 <div className="flex flex-col gap-3">
                   <FilterSlider 
                     label="Brightness" 
                     value={activeScene.sources.find(s => s.id === selectedSourceId)?.filters.brightness || 100} 
                     onChange={async (v) => {
                       try {
                         await setDoc(doc(db, 'sceneItems', selectedSourceId!), {
                           filters: { ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters, brightness: v },
                           updatedAt: serverTimestamp()
                         }, { merge: true });
                       } catch (error) {
                         handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${selectedSourceId}`);
                       }
                     }}
                   />
                   <FilterSlider 
                     label="Contrast" 
                     value={activeScene.sources.find(s => s.id === selectedSourceId)?.filters.contrast || 100} 
                     onChange={async (v) => {
                      try {
                        await setDoc(doc(db, 'sceneItems', selectedSourceId!), {
                          filters: { ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters, contrast: v },
                          updatedAt: serverTimestamp()
                        }, { merge: true });
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${selectedSourceId}`);
                      }
                     }}
                   />
                   
                   {/* Chroma Key Controls */}
                   <div className="border-t border-obs-border pt-2 mt-1">
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-bold text-obs-text-dim uppercase">Chroma Key</span>
                       <input 
                         type="checkbox" 
                         checked={activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey?.enabled || false}
                         onChange={async (e) => {
                           const enabled = e.target.checked;
                           try {
                             await setDoc(doc(db, 'sceneItems', selectedSourceId!), {
                               filters: { 
                                 ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters, 
                                 chromaKey: { ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey!, enabled } 
                               },
                               updatedAt: serverTimestamp()
                             }, { merge: true });
                           } catch (error) {
                             handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${selectedSourceId}`);
                           }
                         }}
                         className="w-3 h-3 accent-blue-500"
                       />
                     </div>
                     
                     {activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey?.enabled && (
                       <div className="flex flex-col gap-3 ml-1 border-l border-blue-500/30 pl-2">
                         <div className="flex items-center justify-between">
                           <span className="text-[9px] text-obs-text-dim uppercase">Key Color</span>
                           <input 
                             type="color" 
                             value={activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey?.color || '#00ff00'}
                             onChange={async (e) => {
                               const color = e.target.value;
                               try {
                                 await setDoc(doc(db, 'sceneItems', selectedSourceId!), {
                                   filters: { 
                                     ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters, 
                                     chromaKey: { ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey!, color } 
                                   },
                                   updatedAt: serverTimestamp()
                                 }, { merge: true });
                               } catch (error) {
                                 handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${selectedSourceId}`);
                               }
                             }}
                             className="w-10 h-5 bg-transparent border-none p-0 cursor-pointer"
                           />
                         </div>
                         
                         <FilterSlider 
                           label="Similarity"
                           min={1}
                           max={100}
                           value={activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey?.similarity || 30}
                           onChange={async (v) => {
                             try {
                               await setDoc(doc(db, 'sceneItems', selectedSourceId!), {
                                 filters: { 
                                   ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters, 
                                   chromaKey: { ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey!, similarity: v } 
                                 },
                                 updatedAt: serverTimestamp()
                               }, { merge: true });
                             } catch (error) {
                               handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${selectedSourceId}`);
                             }
                           }}
                         />
                         
                         <FilterSlider 
                           label="Smoothness"
                           min={1}
                           max={100}
                           value={activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey?.smoothness || 10}
                           onChange={async (v) => {
                             try {
                               await setDoc(doc(db, 'sceneItems', selectedSourceId!), {
                                 filters: { 
                                   ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters, 
                                   chromaKey: { ...activeScene.sources.find(s => s.id === selectedSourceId)?.filters.chromaKey!, smoothness: v } 
                                 },
                                 updatedAt: serverTimestamp()
                               }, { merge: true });
                             } catch (error) {
                               handleFirestoreError(error, OperationType.UPDATE, `sceneItems/${selectedSourceId}`);
                             }
                           }}
                         />
                       </div>
                     )}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mixer Dock */}
          <Dock id="dock-mixer" title="Audio Mixer" className="col-span-3">
            <div id="mixer-container" className="flex flex-col h-full">
               <div id="mixer-scroll-area" className="flex-1 overflow-auto py-2 px-1 space-y-4 bg-black/10 rounded-sm">
                  {activeScene.sources.filter(s => s.type === 'camera' || s.type === 'screen' || s.type === 'droidcam').length > 0 ? (
                    activeScene.sources
                      .filter(s => s.type === 'camera' || s.type === 'screen' || s.type === 'droidcam')
                      // @ts-ignore
                      .map(s => <MixerChannel key={s.id} name={s.name} stream={s.stream} />)
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-8">
                       <VolumeX size={32} />
                       <span className="text-[9px] mt-2 font-bold">SILENCE</span>
                    </div>
                  )}
               </div>
            </div>
          </Dock>

          {/* Transitions Dock */}
          <Dock title="Transitions" className="col-span-2">
            <div className="flex flex-col gap-3 p-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-obs-text-dim uppercase font-bold tracking-widest">Active</span>
                <select 
                  value={transitionType}
                  onChange={(e) => setTransitionType(e.target.value as any)}
                  className="bg-obs-bg text-xs px-2 py-1.5 outline-none border border-obs-border rounded focus:border-blue-500 appearance-none cursor-pointer hover:bg-obs-surface transition-colors"
                >
                  <option value="Fade">Fade</option>
                  <option value="Cut">Cut</option>
                  <option value="Swipe">Swipe</option>
                  <option value="Slide">Slide</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-obs-text-dim uppercase font-bold tracking-widest">Duration</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={transitionDuration} 
                    onChange={(e) => setTransitionDuration(Math.max(0, parseInt(e.target.value) || 0))}
                    className="bg-obs-bg text-xs px-1 py-1 w-12 border border-obs-border rounded text-center focus:border-blue-400 outline-none" 
                  />
                  <span className="text-[9px] text-obs-text-dim font-bold">MS</span>
                </div>
              </div>
            </div>
          </Dock>

          {/* Controls Dock */}
          <Dock title="Controls" className="col-span-2">
            <div className="flex flex-col gap-1 p-1 h-full">
              <ControlButton 
                active={isStreaming} 
                onClick={() => setIsStreaming(!isStreaming)}
                label={isStreaming ? "Stop Streaming" : "Start Streaming"}
                activeColor="bg-red-700 shadow-[0_0_15px_rgba(185,28,28,0.4)]"
              />
              <ControlButton 
                active={isRecording} 
                onClick={isRecording ? stopRecording : startRecording}
                label={isRecording ? "Stop Recording" : "Start Recording"}
                activeColor="bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
              />
              <ControlButton 
                active={isScreenRecording} 
                onClick={isScreenRecording ? stopScreenRecording : startScreenRecording}
                label={isScreenRecording ? "Stop Screen Rec" : "Screen Record"}
                activeColor="bg-orange-600 shadow-[0_0_15px_rgba(234,88,12,0.4)]"
              />
              <ControlButton 
                active={isVirtualCam} 
                onClick={isVirtualCam ? stopVirtualCam : startVirtualCam}
                label={isVirtualCam ? "Stop Virtual Cam" : "Start Virtual Cam"}
                activeColor="bg-sky-600"
              />
              <ControlButton 
                onClick={openProjector}
                label="Virtual Projector"
                color="bg-indigo-900/40"
              />
              <ControlButton 
                active={studioMode} 
                onClick={() => setStudioMode(!studioMode)}
                label="Studio Mode"
                activeColor="bg-blue-600"
              />
              <ControlButton onClick={() => setShowSettings(true)} label="Settings" color="bg-zinc-800" />
              <ControlButton 
                onClick={analyzeScene} 
                label={isAnalyzing ? "Analyzing..." : "AI Analyze"} 
                color="bg-purple-900/30"
                className="border-purple-500/50 hover:bg-purple-800/50 text-purple-200"
              />
              <div className="mt-auto border-t border-obs-border pt-1">
                <ControlButton label="Exit" className="opacity-40 hover:opacity-100 hover:bg-zinc-900 border-none" />
              </div>
            </div>
          </Dock>
            </div>
          </div>
        )}
      </div>
    </>
  )}

      {/* Status Bar */}
      <div className="bg-obs-surface border-t border-obs-border px-3 py-1 flex items-center gap-6 text-[10px] font-bold text-obs-text-dim uppercase tracking-tight font-mono">
        <div className="flex items-center gap-1.5 min-w-[80px]">
          <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-obs-text-dim/30'}`} />
          <span>Live: {isStreaming ? 'Streaming' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-[80px]">
          <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-obs-text-dim/30'}`} />
          <span>Rec: {isRecording ? 'ACTIVE' : 'OFF'}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-[80px]">
          <div className={`w-1.5 h-1.5 rounded-full ${isVirtualCam ? 'bg-sky-500' : 'bg-obs-text-dim/30'}`} />
          <span className={isVirtualCam ? 'text-sky-400' : ''}>V-Cam: {isVirtualCam ? 'ACTIVE' : 'OFF'}</span>
        </div>
        <div className="h-3 w-px bg-obs-border" />
        <div className="flex gap-4">
          <span>CPU: {cpuUsage.toFixed(1)}%</span>
          <span>FPS: {fpsValue.toFixed(1)}</span>
          <span>kbps: {isStreaming ? bitrate : 0}</span>
        </div>
        <div className="ml-auto flex gap-4 text-[9px] opacity-60">
          <span>{outputResolution}</span>
          <span>{encoder}</span>
        </div>
      </div>

      {/* AI Advice Modal */}
      <AnimatePresence>
        {aiAdvice && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-12">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-zinc-900 border-2 border-purple-500/50 w-full max-w-xl p-8 rounded-xl shadow-[0_0_50px_rgba(168,85,247,0.2)] flex flex-col gap-6"
            >
              <div className="flex items-center gap-3 text-purple-400">
                <Sparkles size={24} />
                <h2 className="text-2xl font-black italic tracking-tighter uppercase">AI Production Insight</h2>
              </div>
              <div className="text-zinc-300 leading-relaxed font-medium">
                {aiAdvice}
              </div>
              <button 
                onClick={() => setAiAdvice(null)}
                className="mt-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all"
              >
                GOT IT
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Page Components ---

function NavBtn({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-blue-500' : 'text-zinc-500 hover:text-white'}`}>
      {icon}
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function FilePage({ recordings, studioId, onSummarize, isAnalyzing, aiSummary }: { recordings: any[], studioId: string | null, onSummarize: (rec: any) => void, isAnalyzing: boolean, aiSummary: any }) {
  return (
    <div className="p-4 md:p-8 flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">Media Library</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Local & Cloud Persisted Assets</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-colors">Import</button>
          <button className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-colors shadow-lg">New Folder</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 group cursor-pointer hover:bg-blue-600/20 transition-all border-dashed">
           <Plus size={32} className="text-blue-400 group-hover:scale-110 transition-transform" />
           <span className="text-[10px] font-black text-blue-300 uppercase">Quick Record</span>
        </div>
        
        {recordings.map(rec => (
          <div key={rec.id} className="bg-obs-surface border border-obs-border rounded-2xl overflow-hidden group hover:border-blue-500/50 transition-all flex flex-col">
             <div className="aspect-video bg-zinc-900 relative flex items-center justify-center">
                <Video size={24} className="text-zinc-700" />
                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[8px] font-bold text-white uppercase tracking-tighter">
                  {rec.status}
                </div>
                {aiSummary?.id === rec.id && (
                  <div className="absolute inset-0 bg-purple-900/40 p-4 overflow-auto backdrop-blur-sm">
                    <span className="text-[8px] font-black text-purple-300 uppercase">AI Summary</span>
                    <p className="text-[8px] text-white mt-1 leading-relaxed">{aiSummary.text}</p>
                  </div>
                )}
             </div>
             <div className="p-3 flex-1 flex flex-col">
                <h3 className="text-[10px] font-black text-white truncate uppercase tracking-tight">{rec.name || 'Untitled Stream'}</h3>
                <p className="text-[8px] text-zinc-500 font-mono mt-1">{new Date(rec.startTime?.toDate()).toLocaleString()}</p>
                <div className="mt-auto pt-3 flex gap-1">
                   <button className="flex-1 bg-white/5 hover:bg-white/10 p-1.5 rounded-lg text-[8px] font-black uppercase">Play</button>
                   <button 
                     onClick={() => onSummarize(rec)}
                     disabled={isAnalyzing}
                     className="flex-1 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white p-1.5 rounded-lg text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                   >
                     <Sparkles size={10} />
                     {isAnalyzing && aiSummary?.id === rec.id ? '...' : 'AI Summary'}
                   </button>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorPage({ activeScene, studioId, onOptimize, onGenerateScript, generatedScript, setGeneratedScript, isAnalyzing }: { activeScene: Scene, studioId: string | null, onOptimize: () => void, onGenerateScript: () => void, generatedScript: string | null, setGeneratedScript: (s: string | null) => void, isAnalyzing: boolean }) {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-8">
       <div className="flex flex-col">
          <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">Feed Editor</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Canvas Composition & Filter Master</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="aspect-video bg-black rounded-2xl border border-obs-border shadow-2xl relative overflow-hidden group">
                 <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 opacity-10 pointer-events-none">
                    {Array.from({ length: 144 }).map((_, i) => <div key={i} className="border-[0.5px] border-white/20" />)}
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <Layout size={64} className="text-zinc-900" />
                 </div>
                 {/* Mini previews for all sources */}
                 <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {activeScene.sources.map(s => (
                       <div key={s.id} className="h-20 aspect-video bg-zinc-800 rounded-lg border border-white/10 shrink-0 relative overflow-hidden">
                          <SourceVideo id={s.id} stream={s.stream} url={s.url} locked={true} type={s.type} filters={s.filters} />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                             <Maximize2 size={16} />
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

              {generatedScript && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900 border border-purple-500/30 p-6 rounded-2xl relative"
                >
                  <button 
                    onClick={() => setGeneratedScript(null)}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                  >
                    <Plus className="rotate-45" size={20} />
                  </button>
                  <div className="flex items-center gap-2 text-purple-400 mb-4">
                    <FileCode size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">AI Generated Script</span>
                  </div>
                  <div className="text-sm text-zinc-300 leading-relaxed font-medium bg-black/30 p-4 rounded-xl border border-white/5 max-h-[300px] overflow-auto whitespace-pre-wrap font-mono">
                    {generatedScript}
                  </div>
                </motion.div>
              )}

              <div className="bg-obs-surface p-6 rounded-2xl border border-obs-border">
                 <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4">Composition Timeline</h3>
                 <div className="flex flex-col gap-2">
                    {activeScene.sources.length === 0 && <p className="text-[10px] text-zinc-500 italic">No sources in this scene yet.</p>}
                    {activeScene.sources.map((s, i) => (
                       <div key={s.id} className="flex items-center gap-4 bg-obs-bg p-3 rounded-xl border border-white/5 group hover:border-blue-500/30 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">{i+1}</div>
                          <div className="flex-1">
                             <p className="text-xs font-bold text-white uppercase tracking-tight">{s.name}</p>
                             <p className="text-[9px] text-zinc-500 font-medium uppercase">{s.type} source • {s.locked ? 'Locked' : 'Unlocked'}</p>
                          </div>
                          <div className="flex gap-2">
                             <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><Settings size={14}/></button>
                             <button className="p-2 bg-red-800/20 text-red-500 hover:bg-red-800/40 rounded-lg"><Trash2 size={14}/></button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="flex flex-col gap-6">
              <div className="bg-obs-surface p-6 rounded-2xl border border-obs-border">
                 <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Scene Properties</h3>
                 <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                       <label className="text-[9px] font-black text-zinc-500 uppercase">Scene Name</label>
                       <input type="text" value={activeScene.name} readOnly className="bg-obs-bg border border-obs-border p-2 rounded text-xs text-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                       <label className="text-[9px] font-black text-zinc-500 uppercase">Transitions</label>
                       <div className="grid grid-cols-2 gap-2">
                          <button className="p-2 bg-blue-600 rounded text-[9px] font-black uppercase">Fade (300ms)</button>
                          <button className="p-2 bg-zinc-800 rounded text-[9px] font-black uppercase">Cut</button>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-purple-900/10 border border-purple-500/20 p-6 rounded-2xl flex flex-col gap-3 relative overflow-hidden group">
                 <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                 <div className="flex items-center gap-2 text-purple-400">
                    <Sparkles size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">AI Mastering</span>
                 </div>
                 <p className="text-[10px] text-purple-200/60 leading-snug font-medium italic">"Automatically balancing lighting across active sources to prevent highlights and suggest z-order."</p>
                 <div className="flex flex-col gap-2 mt-2">
                   <button 
                    onClick={onOptimize}
                    disabled={isAnalyzing}
                    className="w-full bg-purple-600 hover:bg-purple-500 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                   >
                     {isAnalyzing ? <Zap size={14} className="animate-pulse" /> : <Sparkles size={14} />}
                     {isAnalyzing ? '...' : 'Optimize Scene'}
                   </button>
                   <button 
                    onClick={onGenerateScript}
                    disabled={isAnalyzing}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-all border border-white/5"
                   >
                     <FileCode size={14} />
                     {isAnalyzing ? '...' : 'Generate Script'}
                   </button>
                 </div>
              </div>
           </div>
        </div>
    </div>
  );
}

function ProfilePage({ user, logout, recordings, scenes }: { user: any, logout: () => void, recordings: any[], scenes: any[] }) {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-10">
       <div className="flex flex-col items-center text-center gap-6">
          <div className="relative group">
             <div className="absolute -inset-4 bg-blue-600/20 rounded-full blur-2xl group-hover:bg-blue-600/40 transition-all opacity-50" />
             <img src={user.photoURL || 'https://ui-avatars.com/api/?name=User'} alt="Avatar" className="w-32 h-32 rounded-full border-4 border-blue-600 shadow-2xl relative" />
             <div className="absolute bottom-1 right-1 bg-green-500 w-8 h-8 rounded-full border-4 border-obs-surface flex items-center justify-center">
                <WifiOff size={12} className="text-white hidden" />
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
             </div>
          </div>
          <div className="flex flex-col gap-1">
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{user.displayName || 'Creator'}</h2>
             <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.3em]">{user.email}</p>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Live Streams" value={recordings.length} icon={<Radio size={20} className="text-blue-400"/>}/>
          <StatCard label="Total Saved" value="1.2 GB" icon={<Database size={20} className="text-purple-400"/>}/>
          <StatCard label="App Uptime" value="12h 4m" icon={<Activity size={20} className="text-green-400"/>}/>
       </div>

       <div className="bg-obs-surface p-8 rounded-3xl border border-obs-border">
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Cloud Studio Settings</h3>
          <div className="flex flex-col gap-4">
             <ProfileSetting label="Automatic Sync" enabled />
             <ProfileSetting label="Multi-User Viewing" />
             <ProfileSetting label="Hardware Acceleration" enabled />
             <div className="pt-4 mt-4 border-t border-white/5">
                <button onClick={logout} className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border border-red-500/20">
                   Terminate Session
                </button>
             </div>
          </div>
       </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-obs-surface p-6 rounded-2xl border border-obs-border flex flex-col items-center justify-center gap-2 group hover:border-white/10 transition-colors">
       <div className="mb-1">{icon}</div>
       <p className="text-3xl font-black text-white tracking-tighter italic">{value}</p>
       <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function ProfileSetting({ label, enabled }: { label: string, enabled?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
       <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-tight">{label}</span>
       <div className={`w-10 h-5 rounded-full relative transition-colors ${enabled ? 'bg-blue-600' : 'bg-zinc-800'}`}>
          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${enabled ? 'right-1' : 'left-1'}`} />
       </div>
    </div>
  );
}

function SettingRow({ label, description, enabled, onToggle }: { label: string, description: string, enabled?: boolean, onToggle?: () => void }) {
  return (
    <div className="flex items-center justify-between group">
       <div className="flex flex-col gap-0.5">
          <p className="text-sm font-black text-white uppercase tracking-tight">{label}</p>
          <p className="text-[10px] text-zinc-500 font-medium">{description}</p>
       </div>
       <button 
         onClick={onToggle}
         className={`w-12 h-6 rounded-full relative transition-all ${enabled ? 'bg-blue-600' : 'bg-zinc-800'} ${!onToggle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
       >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all ${enabled ? 'right-1' : 'left-1'}`} />
       </button>
    </div>
  );
}

function SelectRow({ label, options, value, onChange }: { label: string, options: string[], value: string, onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</label>
       <select 
         value={value} 
         onChange={(e) => onChange(e.target.value)}
         className="w-full bg-black/40 border border-obs-border p-3 rounded-xl text-white text-xs font-bold uppercase outline-none focus:border-blue-500 transition-colors"
       >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
       </select>
    </div>
  );
}

function SourceAddBtn({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 bg-obs-bg hover:bg-blue-600 hover:text-white px-2 py-2 rounded-sm transition-all text-left border border-white/5"
    >
      <div className="text-obs-text-dim group-hover:text-white">{icon}</div>
      <span className="text-[9px] text-obs-text font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function FilterSlider({ label, value, onChange, min = 0, max = 200 }: { label: string, value: number, onChange: (v: number) => void, min?: number, max?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-[9px] font-bold text-obs-text-dim uppercase">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-obs-bg rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}

const MixerChannel = ({ name, stream, color = 'bg-blue-600' }: { name: string, stream?: MediaStream, color?: string }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream || isMuted) {
      setLevel(0);
      return;
    }

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animationId: number;

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        // Map average (0-255) to a visible level, normalized by volume
        setLevel((average / 255) * volume * 2); 
        animationId = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      return () => {
        cancelAnimationFrame(animationId);
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(console.error);
        }
      };
    } catch (err) {
      console.warn("Audio Context failed for", name, err);
      return () => {};
    }
  }, [stream, isMuted, volume, name]);

  return (
    <div id={`mixer-channel-${(name || '').replace(/\s+/g, '-').toLowerCase()}`} className="flex flex-col gap-1 group bg-black/20 p-1.5 rounded border border-white/5">
      <div className="flex justify-between items-center text-[10px] font-bold tracking-tight">
        <span id={`mixer-label-${(name || '').replace(/\s+/g, '-').toLowerCase()}`} className="text-obs-text-dim group-hover:text-white transition-colors truncate max-w-[70%]">{name}</span>
        <span className="text-[8px] opacity-30 font-mono">{isMuted ? 'MUTED' : `${(Math.max(-60, level * 100 - 60)).toFixed(1)} DB`}</span>
      </div>
      <div className="h-2 bg-black/60 rounded-full relative overflow-hidden border border-white/5">
        <motion.div 
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(100, level * 100)}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`absolute inset-y-0 left-0 ${isMuted ? 'bg-obs-border' : `${color} shadow-[0_0_10px_rgba(37,99,235,0.3)]`}`}
        />
        <div className="absolute right-0 top-0 bottom-0 w-[15%] bg-red-600/30" />
        <div className="absolute right-[15%] top-0 bottom-0 w-[20%] bg-yellow-600/30" />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <button 
          id={`mixer-mute-${(name || '').replace(/\s+/g, '-').toLowerCase()}`}
          onClick={() => setIsMuted(!isMuted)}
          className={`p-1.5 rounded-full hover:bg-obs-border transition-colors ${isMuted ? 'text-red-500 bg-red-500/10' : 'text-obs-text-dim hover:text-white bg-white/5'}`}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <div className="flex-1 px-1">
          <input 
            id={`mixer-fader-${(name || '').replace(/\s+/g, '-').toLowerCase()}`}
            type="range" 
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-1 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" 
            style={{ appearance: 'none', background: 'rgba(255,255,255,0.1)' }}
          />
        </div>
        <Settings size={12} className="text-obs-text-dim hover:text-white cursor-pointer transition-colors" />
      </div>
    </div>
  );
}

function ControlButton({ 
  label, 
  active, 
  onClick, 
  color = "bg-obs-surface", 
  activeColor = "bg-blue-700",
  className = ""
}: { 
  label: string, 
  active?: boolean, 
  onClick?: () => void, 
  color?: string, 
  activeColor?: string,
  className?: string
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full py-2.5 text-[10px] font-bold uppercase tracking-widest rounded border border-white/5 transition-all active:scale-[0.98] shadow-lg ${active ? `${activeColor} text-white border-transparent` : `${color} text-obs-text-dim hover:text-white hover:bg-obs-border`} ${className}`}
    >
      {label}
    </button>
  );
}
