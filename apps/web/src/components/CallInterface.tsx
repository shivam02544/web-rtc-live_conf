'use client';

import { useRef, useState } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { DeviceSettings } from './DeviceSettings';
import { QualityIndicator } from './QualityIndicator';
import { DataChannelPanel } from './DataChannelPanel';
import { parseJwt } from '@video-call/shared';

export default function CallInterface({ token, targetUserId }: { token: string; targetUserId?: string }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const currentUser = token ? parseJwt(token) : null;
  const currentUserId = currentUser?.userId || 'unknown';

  const {
    callState,
    incomingCall,
    stats,
    isScreenSharing,
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
    
    dcState,
    chatMessages,
    fileTransfers,
    sendChat,
    sendFileOffer,
    acceptFile,
    rejectFile,
    cancelFile
  } = useWebRTC(localVideoRef, remoteVideoRef, token);

  const toggleMute = () => {
    if (isMuted) unmuteMicrophone();
    else muteMicrophone();
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    if (isCameraOff) enableCamera();
    else disableCamera();
    setIsCameraOff(!isCameraOff);
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) stopScreenShare();
    else startScreenShare();
  };

  const handleSpeakerChange = (deviceId: string) => {
    if (remoteVideoRef.current && 'setSinkId' in remoteVideoRef.current) {
      remoteVideoRef.current.setSinkId(deviceId).catch(console.error);
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="absolute inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-8 max-w-sm w-full border border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
              </div>

              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                Incoming Call
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-lg mb-8">
                {incomingCall.fromName} is calling you
              </p>

              <div className="flex gap-4">
                <button
                  onClick={rejectCall}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Decline
                </button>
                <button
                  onClick={acceptCall}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Layout */}
      <div className="relative w-full h-full">
        {/* Remote Video (Full Screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover bg-slate-900"
        />

        {/* Local Video (Picture-in-Picture) - Premium Design */}
        <div className="absolute top-3 right-3 sm:top-5 sm:right-5 w-32 sm:w-48 aspect-video bg-slate-900 rounded-lg overflow-hidden shadow-md border border-white/20 z-10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
          {isCameraOff && (
            <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-slate-800 flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-xs text-slate-400 font-medium">Camera Off</p>
              </div>
            </div>
          )}
        </div>

        {/* Quality Indicator - Top Left */}
        {callState === 'CONNECTED' && stats && (
          <div className="absolute top-6 left-6 z-10">
            <QualityIndicator stats={stats} />
          </div>
        )}

        {/* Call State Overlay */}
        {callState !== 'IDLE' && callState !== 'CONNECTED' && (
          <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center z-20">
            <div className="text-center px-8 py-8 bg-slate-900/90 rounded-xl border border-white/10">
              <div className="w-10 h-10 mx-auto mb-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white text-xl font-bold">
                {callState === 'CALLING' && 'Calling...'}
                {callState === 'RINGING' && 'Ringing...'}
                {callState === 'CONNECTING' && 'Connecting...'}
                {callState === 'RECONNECTING' && 'Reconnecting...'}
                {callState === 'REJECTED' && 'Call Rejected'}
                {callState === 'FAILED' && 'Call Failed'}
              </p>
            </div>
          </div>
        )}

        {/* Premium Call Controls */}
        {(callState === 'CONNECTED' || callState === 'RECONNECTING') && (
          <div className="absolute bottom-3 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-1rem)]">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-slate-900/95 rounded-xl shadow-xl border border-white/10">
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                className={`group relative w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                  isMuted
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              {/* Camera Button */}
              <button
                onClick={toggleCamera}
                className={`group relative w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                  isCameraOff
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  {isCameraOff && <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />}
                </svg>
              </button>

              {/* Screen Share Button */}
              <button
                onClick={toggleScreenShare}
                className={`group relative w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                  isScreenSharing
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>

              {/* Chat Button */}
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`group relative w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                  isChatOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Chat & Files"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {chatMessages.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 bg-red-500 rounded-full text-[11px] font-bold flex items-center justify-center text-white shadow-lg animate-pulse">
                    {chatMessages.length}
                  </span>
                )}
              </button>

              {/* Device Settings */}
              <DeviceSettings
                onCameraChange={switchCamera}
                onMicrophoneChange={switchMicrophone}
                onSpeakerChange={handleSpeakerChange}
                isScreenSharing={isScreenSharing}
              />

              {/* Divider */}
              <div className="w-px h-7 bg-white/15 mx-0.5"></div>

              {/* End Call Button */}
              <button
                onClick={endCall}
                className="w-10 h-10 sm:w-14 sm:h-14 bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center text-white transition-colors"
                title="End call"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498A1 1 0 0121 14.72V18a2 2 0 01-2 2h-1C9.716 20 4 14.284 4 7V5z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Empty State - No User Selected */}
        {callState === 'IDLE' && !incomingCall && !targetUserId && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">Ready to Connect</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">
                Select a user from the sidebar to start a video call
              </p>
            </div>
          </div>
        )}

        {/* Start Call Button */}
        {callState === 'IDLE' && !incomingCall && targetUserId && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => startCall(targetUserId)}
              className="group bg-indigo-600 hover:bg-indigo-700 px-7 py-4 rounded-xl text-white font-semibold text-base transition-colors flex items-center gap-3"
            >
              <svg className="w-7 h-7 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>Start Call</span>
            </button>
          </div>
        )}
      </div>

      {/* Data Channel Panel */}
      {isChatOpen && callState === 'CONNECTED' && (
        <div className="absolute top-0 right-0 h-full z-40">
          <DataChannelPanel
            dcState={dcState}
            chatMessages={chatMessages}
            fileTransfers={fileTransfers}
            currentUserId={currentUserId}
            onSendChat={sendChat}
            onSendFile={sendFileOffer}
            onAcceptFile={acceptFile}
            onRejectFile={rejectFile}
            onCancelFile={cancelFile}
            onClose={() => setIsChatOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
