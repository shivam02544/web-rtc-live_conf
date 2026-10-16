import { useState, useEffect, useRef } from 'react';
import { MediaDeviceManager, MediaDeviceInfo } from '../lib/MediaDeviceManager';

interface DeviceSettingsProps {
  onCameraChange: (deviceId: string) => void;
  onMicrophoneChange: (deviceId: string) => void;
  onSpeakerChange: (deviceId: string) => void;
  isScreenSharing: boolean;
}

export function DeviceSettings({ onCameraChange, onMicrophoneChange, onSpeakerChange, isScreenSharing }: DeviceSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const manager = MediaDeviceManager.getInstance();
    const unsubscribe = manager.addListener((newDevices) => {
      setDevices(newDevices);
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const cameras = devices.filter(d => d.kind === 'videoinput');
  const microphones = devices.filter(d => d.kind === 'audioinput');
  const speakers = devices.filter(d => d.kind === 'audiooutput');

  const supportsSetSinkId = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center transition-colors bg-slate-700 hover:bg-slate-600 text-white"
        aria-label="Device settings"
        title="Device settings"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isOpen && (
        <div ref={modalRef} className="absolute bottom-full right-0 mb-3 w-80 max-w-[calc(100vw-2rem)] bg-slate-900 rounded-xl shadow-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-lg text-white">Device Settings</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide" htmlFor="camera-select">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Camera
                </div>
              </label>
              <select 
                id="camera-select"
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                value={selectedCamera}
                disabled={isScreenSharing}
                onChange={(e) => {
                  setSelectedCamera(e.target.value);
                  onCameraChange(e.target.value);
                }}
              >
                {cameras.length === 0 && <option value="">No cameras found</option>}
                {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
              </select>
              {isScreenSharing && (
                <p className="text-xs text-yellow-400 mt-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Disabled while screen sharing
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide" htmlFor="mic-select">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Microphone
                </div>
              </label>
              <select 
                id="mic-select"
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={selectedMicrophone}
                onChange={(e) => {
                  setSelectedMicrophone(e.target.value);
                  onMicrophoneChange(e.target.value);
                }}
              >
                {microphones.length === 0 && <option value="">No microphones found</option>}
                {microphones.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
              </select>
            </div>

            {supportsSetSinkId && speakers.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide" htmlFor="speaker-select">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    Speaker
                  </div>
                </label>
                <select 
                  id="speaker-select"
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={selectedSpeaker}
                  onChange={(e) => {
                    setSelectedSpeaker(e.target.value);
                    onSpeakerChange(e.target.value);
                  }}
                >
                  {speakers.map(s => <option key={s.deviceId} value={s.deviceId}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
