import { WebRTCStatsManager } from './WebRTCStatsManager';

export type ConnectionState = 'NEW' | 'CHECKING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'FAILED' | 'CLOSED';

export interface WebRTCConnectionManagerOptions {
  onConnectionStateChange: (state: ConnectionState) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  iceServers?: RTCIceServer[];
}

export class WebRTCConnectionManager {
  private pc: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private dataChannelCreated = false;
  private options: WebRTCConnectionManagerOptions;
  public statsManager: WebRTCStatsManager | null = null;
  
  constructor(options: WebRTCConnectionManagerOptions) {
    this.options = options;
  }

  public initialize(stream?: MediaStream | null) {
    this.cleanup();
    
    const pc = new RTCPeerConnection({
      iceServers: this.options.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.statsManager = new WebRTCStatsManager(pc);

    pc.onconnectionstatechange = () => {
      this.handleConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.statsManager?.start();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected') {
        this.options.onConnectionStateChange('DISCONNECTED');
      } else if (pc.iceConnectionState === 'failed') {
        this.options.onConnectionStateChange('FAILED');
      } else if (pc.iceConnectionState === 'checking') {
        this.options.onConnectionStateChange('CHECKING');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.onIceCandidate(event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams.length > 0) {
        this.options.onRemoteStream(event.streams[0]);
      } else {
        const remoteStream = new MediaStream([event.track]);
        this.options.onRemoteStream(remoteStream);
      }
    };

    pc.ondatachannel = (event) => {
      if (this.options.onDataChannel) {
        this.options.onDataChannel(event.channel);
      }
    };

    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    this.pc = pc;
    this.remoteDescriptionSet = false;
    this.dataChannelCreated = false;
    this.pendingIceCandidates = [];
  }

  public async replaceTrack(newTrack: MediaStreamTrack) {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    const sender = senders.find(s => s.track?.kind === newTrack.kind);
    if (sender) {
      await sender.replaceTrack(newTrack);
    } else {
      // If no sender for this kind, maybe add it
      const stream = new MediaStream([newTrack]);
      this.pc.addTrack(newTrack, stream);
    }
  }

  public async createOffer(iceRestart = false): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    if (!this.dataChannelCreated && this.options.onDataChannel) {
      const dc = this.pc.createDataChannel('app-data', { ordered: true });
      this.options.onDataChannel(dc);
      this.dataChannelCreated = true;
    }
    const offer = await this.pc.createOffer({ iceRestart });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  public async setRemoteDescription(description: RTCSessionDescriptionInit) {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(description));
    this.remoteDescriptionSet = true;
    await this.flushPendingCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    
    if (this.remoteDescriptionSet) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate', err);
      }
    } else {
      this.pendingIceCandidates.push(candidate);
    }
  }

  private async flushPendingCandidates() {
    if (!this.pc) return;
    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];
    
    for (const candidate of candidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding queued ICE candidate', err);
      }
    }
  }

  private handleConnectionState(state: RTCPeerConnectionState) {
    switch (state) {
      case 'new':
        this.options.onConnectionStateChange('NEW');
        break;
      case 'connecting':
        this.options.onConnectionStateChange('CONNECTING');
        break;
      case 'connected':
        this.options.onConnectionStateChange('CONNECTED');
        break;
      case 'disconnected':
        this.options.onConnectionStateChange('DISCONNECTED');
        break;
      case 'failed':
        this.options.onConnectionStateChange('FAILED');
        break;
      case 'closed':
        this.options.onConnectionStateChange('CLOSED');
        break;
    }
  }
  
  public async restartIce() {
    if (!this.pc) return null;
    return await this.createOffer(true);
  }

  public cleanup() {
    if (this.statsManager) {
      this.statsManager.stop();
      this.statsManager = null;
    }
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.remoteDescriptionSet = false;
    this.dataChannelCreated = false;
    this.pendingIceCandidates = [];
  }
}

