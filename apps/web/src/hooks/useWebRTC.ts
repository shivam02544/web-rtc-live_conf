import { useEffect, useRef, useState } from 'react';
import { SignalingMessage, parseJwt } from '@video-call/shared';
import { WebRTCConnectionManager } from '../lib/WebRTCConnectionManager';
import { WebRTCStats } from '../lib/WebRTCStatsManager';
import { MediaDeviceManager } from '../lib/MediaDeviceManager';
import { WebRTCDataChannelManager } from '../lib/WebRTCDataChannelManager';
import { ChatMessage, FileTransferSession, DataChannelState } from '../lib/DataChannelProtocol';
import { logger } from '../lib/logger';
import { metrics } from '../lib/metrics';

type CallState = 'IDLE' | 'CALLING' | 'RINGING' | 'CONNECTING' | 'CONNECTED' | 'REJECTED' | 'FAILED' | 'RECONNECTING';

interface IncomingCall {
  callId: string;
  from: string;
  fromName: string;
}

export function useWebRTC(
  localVideoRef: React.RefObject<HTMLVideoElement | null>,
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>,
  token: string | null
) {
  const [callState, setCallState] = useState<CallState>('IDLE');
  const callStateRef = useRef<CallState>('IDLE');
  
  const updateCallState = (newState: CallState) => {
    setCallState(newState);
    callStateRef.current = newState;
  };

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [stats, setStats] = useState<WebRTCStats | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Data Channel State
  const [dcState, setDcState] = useState<DataChannelState>('IDLE');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [fileTransfers, setFileTransfers] = useState<Record<string, FileTransferSession>>({});
  
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const statsListenerUnsubscribeRef = useRef<(() => void) | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const rtcManagerRef = useRef<WebRTCConnectionManager | null>(null);
  const dcManagerRef = useRef<WebRTCDataChannelManager | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallId = useRef<string | null>(null);

  // Hoisted functions to fix Next.js ESLint react-hooks/immutability
  function resetCall() {
    if (statsListenerUnsubscribeRef.current) {
      statsListenerUnsubscribeRef.current();
      statsListenerUnsubscribeRef.current = null;
    }
    setStats(null);
    setIsScreenSharing(false);
    cameraTrackRef.current = null;

    if (dcManagerRef.current) {
      dcManagerRef.current.cleanup();
      dcManagerRef.current = null;
    }
    setDcState('IDLE');
    setChatMessages([]);
    setFileTransfers({});

    if (rtcManagerRef.current) {
      rtcManagerRef.current.cleanup();
      rtcManagerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setIncomingCall(null);
    activeCallId.current = null;
  }

  function endCall() {
    logger.log('call.ended', { callId: activeCallId.current });
    if (wsRef.current && activeCallId.current) {
      wsRef.current.send(JSON.stringify({
        type: 'CALL_END',
        callId: activeCallId.current
      }));
    }
    resetCall();
    updateCallState('IDLE');
  }

  function connectWebSocket() {
    if (!token) return;
    
    let wsUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:8081';
    if (typeof window !== 'undefined' && (wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1'))) {
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        try {
          const port = new URL(wsUrl).port || '8081';
          wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${port}`;
        } catch (_e) {
          wsUrl = `ws://${window.location.hostname}:8081`;
        }
      }
    }
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      logger.log('websocket.connected');
      metrics.increment('websocket_connections');
      reconnectAttempts.current = 0;
      ws.send(JSON.stringify({ type: 'AUTH', token }));
      
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 30000);
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data) as SignalingMessage;
      
      switch (message.type) {
        case 'CALL_RECONCILE':
          logger.log('webrtc.connection.recovered', { callId: message.callId });
          activeCallId.current = message.callId;
          if (message.state === 'CONNECTED' || message.state === 'NEGOTIATING' || message.state === 'ACCEPTED') {
            if (callStateRef.current === 'IDLE') {
              // If we are IDLE, we need to restart the media and RTC flow
              // Or we just update the UI state and let the RECONNECTING timeout trigger an offer
              updateCallState('RECONNECTING');
              initMedia().then(() => {
                setupWebRTCManager();
              }).catch(err => console.error(err));
            } else if (callStateRef.current === 'RECONNECTING') {
              // We're already trying to reconnect
            }
          }
          break;
          
        case 'INCOMING_CALL':
          if (callStateRef.current === 'IDLE') {
            updateCallState('RINGING');
            setIncomingCall({ callId: message.callId, from: message.from, fromName: message.fromName });
            activeCallId.current = message.callId;
          } else {
            ws.send(JSON.stringify({ type: 'USER_BUSY', callId: message.callId }));
          }
          break;

        case 'CALL_ACCEPT':
          activeCallId.current = message.callId;
          updateCallState('CONNECTING');
          if (rtcManagerRef.current) {
            try {
              const offer = await rtcManagerRef.current.createOffer();
              ws.send(JSON.stringify({
                type: 'CALL_OFFER',
                callId: activeCallId.current,
                payload: offer
              }));
            } catch (err) {
              console.error('Error creating offer', err);
              endCall();
            }
          }
          break;

        case 'CALL_REJECT':
          updateCallState('REJECTED');
          resetCall();
          setTimeout(() => updateCallState('IDLE'), 2000);
          break;

        case 'CALL_OFFER':
          if ((callStateRef.current === 'RINGING' || callStateRef.current === 'CONNECTING' || callStateRef.current === 'CONNECTED') && rtcManagerRef.current) {
            try {
              await rtcManagerRef.current.setRemoteDescription(message.payload);
              const answer = await rtcManagerRef.current.createAnswer();
              ws.send(JSON.stringify({
                type: 'CALL_ANSWER',
                callId: activeCallId.current!,
                payload: answer
              }));
            } catch (err) {
              console.error('Error handling offer', err);
            }
          }
          break;

        case 'CALL_ANSWER':
          if (rtcManagerRef.current) {
            try {
              await rtcManagerRef.current.setRemoteDescription(message.payload);
            } catch (err) {
              console.error('Error handling answer', err);
            }
          }
          break;

        case 'ICE_CANDIDATE':
          if (rtcManagerRef.current) {
            await rtcManagerRef.current.addIceCandidate(message.payload);
          }
          break;

        case 'CALL_END':
          resetCall();
          updateCallState('IDLE');
          break;
      }
    };

    ws.onclose = () => {
      logger.log('websocket.disconnected');
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      
      // Attempt reconnect if not explicitly closed
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        const timeout = Math.pow(2, reconnectAttempts.current) * 1000 + Math.random() * 1000;
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, timeout);
      }
    };

    ws.onerror = (error) => {
      if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        return;
      }
      console.error('WebSocket Error:', error);
    };
  }

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function fetchIceServers(): Promise<RTCIceServer[]> {
    try {
      const res = await fetch('/api/webrtc/ice-servers');
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers) return data.iceServers;
      }
    } catch (err) {
      console.error('Failed to fetch ICE servers', err);
    }
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }

  async function initMedia() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC is only available in secure contexts (HTTPS or localhost). Please use a secure connection.');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e) {
        console.warn('Failed to get video and audio, trying audio only', e);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e2) {
          console.warn('Failed to get audio, trying video only', e2);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Completely failed to get media devices', err);
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.fillText('Camera unavailable', 180, 240);
      }
      try {
        const stream = (canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(15);
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        return stream;
      } catch (canvasErr) {
        console.error('Failed to create dummy canvas stream', canvasErr);
        throw new Error('No media available');
      }
    }
  }

  async function setupWebRTCManager() {
    const iceServers = await fetchIceServers();
    
    const manager = new WebRTCConnectionManager({
      iceServers,
      onConnectionStateChange: async (state) => {
        if (state === 'CONNECTED') {
          logger.log('call.connected', { callId: activeCallId.current });
          metrics.increment('successful_calls');
          updateCallState('CONNECTED');
        } else if (state === 'DISCONNECTED') {
          logger.log('call.reconnecting', { callId: activeCallId.current });
          updateCallState('RECONNECTING');
          setTimeout(async () => {
            if (callStateRef.current === 'RECONNECTING' && rtcManagerRef.current) {
              const offer = await rtcManagerRef.current.restartIce();
              if (offer && wsRef.current && activeCallId.current) {
                wsRef.current.send(JSON.stringify({
                  type: 'CALL_OFFER',
                  callId: activeCallId.current,
                  payload: offer
                }));
              }
            }
          }, 3000);
        } else if (state === 'FAILED') {
          logger.log('call.failed', { callId: activeCallId.current });
          metrics.increment('failed_calls');
          updateCallState('FAILED');
          endCall();
        } else if (state === 'CLOSED') {
          updateCallState('IDLE');
        }
      },
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onIceCandidate: (candidate) => {
        if (wsRef.current && activeCallId.current) {
          wsRef.current.send(JSON.stringify({
            type: 'ICE_CANDIDATE',
            callId: activeCallId.current,
            payload: candidate
          }));
        }
      },
      onDataChannel: (channel) => {
        if (!dcManagerRef.current) {
          const payload = token ? parseJwt(token) : null;
          dcManagerRef.current = new WebRTCDataChannelManager({
            userId: payload?.userId || 'unknown',
            onStateChange: setDcState,
            onChatMessage: (msg) => setChatMessages(prev => [...prev, msg]),
            onFileTransferUpdate: setFileTransfers,
            onError: (err) => console.error('DataChannel error:', err)
          });
        }
        dcManagerRef.current.attachChannel(channel);
      }
    });

    manager.initialize(localStreamRef.current);
    rtcManagerRef.current = manager;
    
    if (manager.statsManager) {
      statsListenerUnsubscribeRef.current = manager.statsManager.addListener((newStats) => {
        setStats(newStats);
      });
    }
  }

  async function startCall(targetUserId: string) {
    try {
      logger.log('call.created', { to: targetUserId });
      await initMedia();
      await setupWebRTCManager();
      updateCallState('CALLING');
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'CALL_REQUEST',
          to: targetUserId
        }));
      }
    } catch (err) {
      console.error('startCall failed:', err);
      updateCallState('FAILED');
      setTimeout(() => updateCallState('IDLE'), 3000);
    }
  }

  async function acceptCall() {
    try {
      logger.log('call.accepted', { callId: activeCallId.current });
      await initMedia();
      await setupWebRTCManager();
      updateCallState('CONNECTING');
      if (wsRef.current && activeCallId.current) {
        wsRef.current.send(JSON.stringify({
          type: 'CALL_ACCEPT',
          callId: activeCallId.current
        }));
      }
    } catch (err) {
      console.error('acceptCall failed:', err);
      updateCallState('IDLE');
    }
  }

  function rejectCall() {
    if (wsRef.current && activeCallId.current) {
      wsRef.current.send(JSON.stringify({
        type: 'CALL_REJECT',
        callId: activeCallId.current
      }));
    }
    updateCallState('IDLE');
    setIncomingCall(null);
    activeCallId.current = null;
  }

  function muteMicrophone() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
    }
  }

  function unmuteMicrophone() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
    }
  }

  function disableCamera() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => track.enabled = false);
    }
  }

  function enableCamera() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => track.enabled = true);
    }
  }

  async function switchCamera(deviceId: string) {
    if (!localStreamRef.current || isScreenSharing) return;
    try {
      const newStream = await MediaDeviceManager.getInstance().getCameraStream(deviceId);
      const newTrack = newStream.getVideoTracks()[0];
      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      
      if (oldTrack) {
        oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
      }
      
      localStreamRef.current.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      
      if (rtcManagerRef.current) {
        await rtcManagerRef.current.replaceTrack(newTrack);
      }
      logger.log('webrtc.camera.switched');
    } catch (err) {
      console.error('Camera switch failed', err);
    }
  }

  async function switchMicrophone(deviceId: string) {
    if (!localStreamRef.current) return;
    try {
      const newStream = await MediaDeviceManager.getInstance().getMicrophoneStream(deviceId);
      const newTrack = newStream.getAudioTracks()[0];
      const oldTrack = localStreamRef.current.getAudioTracks()[0];
      
      if (oldTrack) {
        oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
      }
      
      localStreamRef.current.addTrack(newTrack);
      if (rtcManagerRef.current) {
        await rtcManagerRef.current.replaceTrack(newTrack);
      }
      logger.log('webrtc.microphone.switched');
    } catch (err) {
      console.error('Microphone switch failed', err);
    }
  }

  async function startScreenShare() {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      
      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          cameraTrackRef.current = oldVideoTrack;
          // Keep old track alive but remove from local stream
          localStreamRef.current.removeTrack(oldVideoTrack);
        }
        localStreamRef.current.addTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }

      if (rtcManagerRef.current) {
        await rtcManagerRef.current.replaceTrack(screenTrack);
      }

      screenTrack.onended = () => stopScreenShare();
      setIsScreenSharing(true);
      logger.log('webrtc.screen_share.started');
    } catch (err) {
      console.error('Screen share failed', err);
    }
  }

  async function stopScreenShare() {
    if (localStreamRef.current) {
      const screenTrack = localStreamRef.current.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.stop();
        localStreamRef.current.removeTrack(screenTrack);
      }
      
      let cameraTrack = cameraTrackRef.current;
      if (!cameraTrack || cameraTrack.readyState === 'ended') {
         try {
           const cameraStream = await MediaDeviceManager.getInstance().getCameraStream();
           cameraTrack = cameraStream.getVideoTracks()[0];
         } catch(e) { console.error('Failed to restore camera', e); }
      }

      if (cameraTrack) {
        localStreamRef.current.addTrack(cameraTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        if (rtcManagerRef.current) {
          await rtcManagerRef.current.replaceTrack(cameraTrack);
        }
      }
      
      setIsScreenSharing(false);
      cameraTrackRef.current = null;
      logger.log('webrtc.screen_share.stopped');
    }
  }

  return {
    callState,
    incomingCall,
    stats,
    isScreenSharing,
    
    // Data Channel states
    dcState,
    chatMessages,
    fileTransfers,

    startCall,
    acceptCall,
    rejectCall,
    endCall,
    muteMicrophone,
    unmuteMicrophone,
    disableCamera,
    enableCamera,
    switchCamera,
    switchMicrophone,
    startScreenShare,
    stopScreenShare,
    
    // Data Channel Methods
    sendChat: (text: string) => dcManagerRef.current?.sendChat(text),
    sendFileOffer: (file: File) => dcManagerRef.current?.sendFileOffer(file),
    acceptFile: (transferId: string) => dcManagerRef.current?.acceptFile(transferId),
    rejectFile: (transferId: string) => dcManagerRef.current?.rejectFile(transferId),
    cancelFile: (transferId: string, reason?: string) => dcManagerRef.current?.cancelFile(transferId, reason)
  };
}
