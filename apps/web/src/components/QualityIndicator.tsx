import { useState } from 'react';
import { WebRTCStats } from '../lib/WebRTCStatsManager';

export function QualityIndicator({ stats }: { stats: WebRTCStats | null }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!stats || stats.quality === 'UNKNOWN') return null;

  const colorMap = {
    EXCELLENT: { bg: 'bg-emerald-500', text: 'text-emerald-500' },
    GOOD: { bg: 'bg-green-500', text: 'text-green-500' },
    FAIR: { bg: 'bg-yellow-500', text: 'text-yellow-500' },
    POOR: { bg: 'bg-red-500', text: 'text-red-500' }
  };

  const colors = colorMap[stats.quality];

  return (
    <div className="relative">
      <button 
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="flex items-center gap-2.5 bg-slate-900/90 px-3 py-2 rounded-lg border border-white/15 transition-colors hover:bg-slate-800"
      >
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${colors.bg}`}></div>
          <div className={`absolute inset-0 ${colors.bg} rounded-full animate-pulse-ring opacity-50`}></div>
        </div>
        <span className="text-xs font-bold text-white uppercase tracking-wide">{stats.quality}</span>
      </button>

      {isOpen && (
        <div 
          className="absolute bottom-full left-0 mb-3 w-64 bg-slate-900 rounded-lg shadow-xl p-4 text-xs text-white z-50 pointer-events-none border border-slate-700"
        >
          <h4 className="text-sm font-bold mb-3 text-white">Connection Quality</h4>
          
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Latency</span>
              <span className="font-semibold">{Math.round(stats.rtt)} ms</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Packet Loss</span>
              <span className={`font-semibold ${stats.packetLoss > 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                {stats.packetLoss.toFixed(1)}%
              </span>
            </div>
            
            <div className="h-px bg-white/10 my-2"></div>
            
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Video Bitrate</span>
              <span className="font-semibold">{(stats.videoBitrate / 1000).toFixed(0)} kbps</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Audio Bitrate</span>
              <span className="font-semibold">{(stats.audioBitrate / 1000).toFixed(0)} kbps</span>
            </div>
            
            {stats.videoFramesDropped > 0 && (
              <>
                <div className="h-px bg-white/10 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Dropped Frames</span>
                  <span className="font-semibold text-red-400">{stats.videoFramesDropped}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
