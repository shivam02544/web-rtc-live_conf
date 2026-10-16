import { logger } from './logger';

export type QualityState = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN';

export interface WebRTCStats {
  quality: QualityState;
  rtt: number;
  videoBitrate: number;
  audioBitrate: number;
  packetLoss: number;
  videoFramesDropped: number;
}

type StatsListener = (stats: WebRTCStats) => void;

export class WebRTCStatsManager {
  private pc: RTCPeerConnection;
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: Set<StatsListener> = new Set();
  private lastQuality: QualityState = 'UNKNOWN';
  
  // Previous states for delta calculations
  private lastVideoBytesSent = 0;
  private lastAudioBytesSent = 0;
  private lastTimestamp = 0;

  constructor(pc: RTCPeerConnection) {
    this.pc = pc;
  }

  public start(intervalMs: number = 2000) {
    this.stop();
    this.intervalId = setInterval(() => this.collect(), intervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public addListener(listener: StatsListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async collect() {
    if (!this.pc || this.pc.connectionState === 'closed') {
      this.stop();
      return;
    }

    try {
      const stats = await this.pc.getStats();
      this.parse(stats);
    } catch (err) {
      console.error('Failed to get stats', err);
    }
  }

  private parse(stats: RTCStatsReport) {
    let rtt = 0;
    let videoBytesSent = 0;
    let audioBytesSent = 0;
    let packetsSent = 0;
    let packetsLost = 0;
    let videoFramesDropped = 0;
    let timestamp = 0;

    stats.forEach((report) => {
      timestamp = report.timestamp;
      
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        if (report.currentRoundTripTime !== undefined) {
          rtt = report.currentRoundTripTime * 1000;
        }
      }

      if (report.type === 'outbound-rtp') {
        if (report.kind === 'video') {
          videoBytesSent = report.bytesSent || 0;
        } else if (report.kind === 'audio') {
          audioBytesSent = report.bytesSent || 0;
        }
        packetsSent += report.packetsSent || 0;
      }
      
      if (report.type === 'remote-inbound-rtp') {
        packetsLost += report.packetsLost || 0;
      }
      
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
         videoFramesDropped += report.framesDropped || 0;
      }
    });

    const elapsedSeconds = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
    
    let videoBitrate = 0;
    let audioBitrate = 0;
    if (elapsedSeconds > 0) {
      videoBitrate = Math.max(0, ((videoBytesSent - this.lastVideoBytesSent) * 8) / elapsedSeconds);
      audioBitrate = Math.max(0, ((audioBytesSent - this.lastAudioBytesSent) * 8) / elapsedSeconds);
    }

    this.lastVideoBytesSent = videoBytesSent;
    this.lastAudioBytesSent = audioBytesSent;
    this.lastTimestamp = timestamp;

    const packetLoss = packetsSent > 0 ? (packetsLost / packetsSent) * 100 : 0;

    const currentStats: WebRTCStats = {
      rtt,
      videoBitrate,
      audioBitrate,
      packetLoss,
      videoFramesDropped,
      quality: this.classify(rtt, packetLoss)
    };

    if (currentStats.quality !== this.lastQuality && currentStats.quality !== 'UNKNOWN') {
      logger.log(`webrtc.connection.${currentStats.quality === 'POOR' ? 'degraded' : 'recovered'}`);
      logger.log(`webrtc.quality.${currentStats.quality.toLowerCase()}`);
      this.lastQuality = currentStats.quality;
    }

    this.listeners.forEach(l => l(currentStats));
  }

  private classify(rtt: number, packetLoss: number): QualityState {
    if (rtt === 0 && packetLoss === 0) return 'UNKNOWN'; // likely no data yet
    if (packetLoss > 5 || rtt > 300) return 'POOR';
    if (packetLoss > 2 || rtt > 150) return 'FAIR';
    if (packetLoss > 0.5 || rtt > 75) return 'GOOD';
    return 'EXCELLENT';
  }
}
