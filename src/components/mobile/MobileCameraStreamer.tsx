import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '../../lib/shared/socket-events';

const socket = io(); // Connects to the same server

export const MobileCameraStreamer: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const [status, setStatus] = useState('Initializing...');

    useEffect(() => {
        const startStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                peerConnection.current = pc;

                // Join room
                socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId: 'mobile-camera', role: 'camera' });

                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit(SOCKET_EVENTS.SIGNAL, { candidate: event.candidate, roomId: 'mobile-camera' });
                    }
                };

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit(SOCKET_EVENTS.SIGNAL, { offer, roomId: 'mobile-camera' });

                setStatus('Streaming');
            } catch (err) {
                console.error(err);
                setStatus('Error: ' + err);
            }
        };

        startStream();

        socket.on(SOCKET_EVENTS.SIGNAL, async (data) => {
            if (data.answer) {
                await peerConnection.current?.setRemoteDescription(data.answer);
            } else if (data.candidate) {
                await peerConnection.current?.addIceCandidate(data.candidate);
            }
        });

        return () => {
            peerConnection.current?.close();
            socket.disconnect();
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
            <h1 className="text-xl mb-4">Mobile Camera Streamer</h1>
            <p className="mb-4">{status}</p>
            <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-lg rounded-lg shadow-lg" />
        </div>
    );
};
