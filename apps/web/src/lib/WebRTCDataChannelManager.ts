import {
  DataChannelState,
  DataMessage,
  ChatMessage,
  FileOfferPayload,
  FileTransferSession,
  PROTOCOL_VERSION,
  MAX_CHAT_MESSAGE_SIZE,
  MAX_DATA_MESSAGE_SIZE,
  MAX_FILE_SIZE,
  TRANSFER_ID_LENGTH,
  LOW_WATERMARK,
  HIGH_WATERMARK,
  CHUNK_SIZE,
  MAX_ACTIVE_FILE_TRANSFERS,
  MAX_PENDING_FILE_OFFERS,
} from './DataChannelProtocol';
import { logger } from './logger';

export interface DataChannelManagerOptions {
  onStateChange: (state: DataChannelState) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onFileTransferUpdate: (transfers: Record<string, FileTransferSession>) => void;
  onError: (error: Error) => void;
  userId: string;
}

export class WebRTCDataChannelManager {
  private channel: RTCDataChannel | null = null;
  private state: DataChannelState = 'IDLE';
  private options: DataChannelManagerOptions;
  
  // File Transfer State
  private transfers: Record<string, FileTransferSession> = {};
  
  // Internal flags for sending loops
  private activeSenders = new Map<string, boolean>();

  constructor(options: DataChannelManagerOptions) {
    this.options = options;
  }

  public attachChannel(channel: RTCDataChannel) {
    this.cleanup();
    this.channel = channel;
    this.channel.binaryType = 'arraybuffer';
    this.channel.bufferedAmountLowThreshold = LOW_WATERMARK;

    this.updateState(
      this.channel.readyState === 'open' ? 'OPEN' 
      : this.channel.readyState === 'connecting' ? 'CONNECTING' 
      : this.channel.readyState === 'closing' ? 'CLOSING' 
      : 'CLOSED'
    );

    this.channel.onopen = () => {
      this.updateState('OPEN');
      logger.log('webrtc.datachannel.open');
    };

    this.channel.onclose = () => {
      this.updateState('CLOSED');
      logger.log('webrtc.datachannel.close');
    };

    this.channel.onerror = (err) => {
      console.error('DataChannel Error', err);
      this.updateState('FAILED');
      logger.log('webrtc.datachannel.error');
      this.options.onError(new Error('DataChannel encountered an error.'));
    };

    this.channel.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          this.handleTextMessage(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          this.handleBinaryMessage(event.data);
        } else if (event.data instanceof Blob) {
          const buffer = await event.data.arrayBuffer();
          this.handleBinaryMessage(buffer);
        }
      } catch (err) {
        console.error('Failed to handle DataChannel message:', err);
      }
    };
    
    // For backpressure resolution
    this.channel.onbufferedamountlow = () => {
      // Senders that are blocked will resume
    };
  }

  private updateState(newState: DataChannelState) {
    this.state = newState;
    this.options.onStateChange(newState);
  }

  private emitTransfersUpdate() {
    this.options.onFileTransferUpdate({ ...this.transfers });
  }

  private handleTextMessage(jsonStr: string) {
    if (jsonStr.length > MAX_DATA_MESSAGE_SIZE) {
      console.warn('Received oversized JSON message');
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.warn('Malformed JSON message');
      return;
    }

    if (!parsed || parsed.version !== PROTOCOL_VERSION || !parsed.type || !parsed.id) {
      console.warn('Invalid protocol envelope');
      return;
    }

    const msg = parsed as DataMessage;

    switch (msg.type) {
      case 'chat.message':
        logger.log('webrtc.chat.received', { messageId: msg.id });
        this.options.onChatMessage(msg);
        break;

      case 'file.offer':
        this.handleFileOffer(msg);
        break;

      case 'file.accept':
        this.handleFileAccept(msg.transferId);
        break;

      case 'file.reject':
        this.handleFileReject(msg.transferId);
        break;

      case 'file.cancel':
        this.handleFileCancel(msg.transferId);
        break;

      case 'file.complete':
        this.handleFileCompleteMsg(msg.transferId);
        break;

      case 'file.error':
        this.handleFileErrorMsg(msg.transferId, msg.error);
        break;
        
      case 'ping':
        this.sendJSON({ version: PROTOCOL_VERSION, id: crypto.randomUUID(), type: 'pong', timestamp: Date.now() });
        break;
        
      case 'pong':
        // RTT tracking if needed
        break;
    }
  }

  private handleBinaryMessage(buffer: ArrayBuffer) {
    if (buffer.byteLength < TRANSFER_ID_LENGTH) {
      console.warn('Binary message too small to contain transfer ID');
      return;
    }

    const idBytes = new Uint8Array(buffer, 0, TRANSFER_ID_LENGTH);
    const transferId = new TextDecoder().decode(idBytes).trim();
    const chunkData = new Uint8Array(buffer, TRANSFER_ID_LENGTH);

    const transfer = this.transfers[transferId];
    if (!transfer) {
      // Silently ignore chunks for unknown transfers (maybe cancelled)
      return;
    }

    if (transfer.state !== 'TRANSFERRING') {
      return;
    }

    transfer.receivedBytes += chunkData.byteLength;
    if (transfer.receivedBytes > transfer.expectedSize) {
      // Security violation
      transfer.state = 'FAILED';
      transfer.error = 'Received more bytes than expected';
      this.cancelFile(transferId, 'Oversized');
      this.emitTransfersUpdate();
      return;
    }

    transfer.chunks.push(chunkData);
    
    // Throttle UI updates or the React state gets hammered.
    // For now, we update state, but in useWebRTC we will throttle React renders.
    this.emitTransfersUpdate();

    if (transfer.receivedBytes === transfer.expectedSize) {
      transfer.state = 'COMPLETED';
      transfer.completedAt = Date.now();
      try {
        const blob = new Blob(transfer.chunks as unknown as BlobPart[], { type: transfer.mimeType });
        transfer.objectUrl = URL.createObjectURL(blob);
      } catch (err) {
        console.error('Failed to create Blob', err);
        transfer.state = 'FAILED';
        transfer.error = 'Failed to reconstruct file';
      }
      // Notify sender
      this.sendJSON({
        version: PROTOCOL_VERSION,
        id: crypto.randomUUID(),
        type: 'file.complete',
        transferId
      });
      logger.log('webrtc.file.complete', { transferId });
      this.emitTransfersUpdate();
    }
  }

  public sendChat(text: string) {
    if (this.state !== 'OPEN') throw new Error('DataChannel not open');
    if (text.length > MAX_CHAT_MESSAGE_SIZE) {
      throw new Error('Chat message too long');
    }

    const msg: ChatMessage = {
      version: PROTOCOL_VERSION,
      id: crypto.randomUUID(),
      type: 'chat.message',
      timestamp: Date.now(),
      senderId: this.options.userId,
      text
    };

    this.sendJSON(msg);
    logger.log('webrtc.chat.sent', { messageId: msg.id });
    // Also notify local UI so it displays immediately
    this.options.onChatMessage(msg);
  }

  public sendFileOffer(file: File) {
    if (this.state !== 'OPEN') throw new Error('DataChannel not open');
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
    }

    const activeOutgoing = Object.values(this.transfers).filter(t => t.direction === 'outgoing' && (t.state === 'OFFERED' || t.state === 'TRANSFERRING'));
    if (activeOutgoing.length >= MAX_ACTIVE_FILE_TRANSFERS) {
      throw new Error('Too many active file transfers');
    }

    const transferId = crypto.randomUUID();
    
    const payload: FileOfferPayload = {
      transferId,
      name: file.name.replace(/[^a-zA-Z0-9.\-_ ]/g, ''), // Basic sanitization
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      lastModified: file.lastModified
    };

    const msg: DataMessage = {
      version: PROTOCOL_VERSION,
      id: crypto.randomUUID(),
      type: 'file.offer',
      payload
    };

    this.transfers[transferId] = {
      transferId,
      fileName: payload.name,
      mimeType: payload.mimeType,
      expectedSize: payload.size,
      receivedBytes: 0,
      chunks: [],
      state: 'OFFERED',
      startedAt: Date.now(),
      direction: 'outgoing',
      file
    };

    this.sendJSON(msg);
    logger.log('webrtc.file.offer', { transferId });
    this.emitTransfersUpdate();
  }

  private handleFileOffer(msg: Extract<DataMessage, { type: 'file.offer' }>) {
    const payload = msg.payload;
    if (payload.size > MAX_FILE_SIZE) {
      this.rejectFile(payload.transferId);
      return;
    }

    const activeIncoming = Object.values(this.transfers).filter(t => t.direction === 'incoming' && (t.state === 'OFFERED' || t.state === 'TRANSFERRING'));
    if (activeIncoming.length >= MAX_PENDING_FILE_OFFERS) {
      this.rejectFile(payload.transferId);
      return;
    }

    this.transfers[payload.transferId] = {
      transferId: payload.transferId,
      fileName: payload.name.replace(/[^a-zA-Z0-9.\-_ ]/g, ''),
      mimeType: payload.mimeType,
      expectedSize: payload.size,
      receivedBytes: 0,
      chunks: [],
      state: 'OFFERED',
      startedAt: Date.now(),
      direction: 'incoming'
    };

    logger.log('webrtc.file.offer_received', { transferId: payload.transferId });
    this.emitTransfersUpdate();
  }

  public acceptFile(transferId: string) {
    const transfer = this.transfers[transferId];
    if (!transfer || transfer.state !== 'OFFERED' || transfer.direction !== 'incoming') return;

    transfer.state = 'TRANSFERRING';
    this.sendJSON({ version: PROTOCOL_VERSION, id: crypto.randomUUID(), type: 'file.accept', transferId });
    logger.log('webrtc.file.accept', { transferId });
    this.emitTransfersUpdate();
  }

  public rejectFile(transferId: string) {
    const transfer = this.transfers[transferId];
    if (transfer && transfer.state === 'OFFERED') {
      transfer.state = 'REJECTED';
      this.emitTransfersUpdate();
    }
    this.sendJSON({ version: PROTOCOL_VERSION, id: crypto.randomUUID(), type: 'file.reject', transferId });
    logger.log('webrtc.file.reject', { transferId });
  }

  public cancelFile(transferId: string, reason = 'Cancelled by user') {
    const transfer = this.transfers[transferId];
    if (!transfer) return;

    if (transfer.state === 'TRANSFERRING' || transfer.state === 'OFFERED') {
      transfer.state = 'CANCELLED';
      transfer.error = reason;
      this.activeSenders.set(transferId, false); // stop sender loop
      this.sendJSON({ version: PROTOCOL_VERSION, id: crypto.randomUUID(), type: 'file.cancel', transferId });
      logger.log('webrtc.file.cancel', { transferId });
      this.emitTransfersUpdate();
    }
  }

  private handleFileAccept(transferId: string) {
    const transfer = this.transfers[transferId];
    if (transfer && transfer.state === 'OFFERED' && transfer.direction === 'outgoing' && transfer.file) {
      transfer.state = 'TRANSFERRING';
      this.emitTransfersUpdate();
      this.startFileTransferLoop(transferId, transfer.file);
    }
  }

  private handleFileReject(transferId: string) {
    const transfer = this.transfers[transferId];
    if (transfer && transfer.state === 'OFFERED') {
      transfer.state = 'REJECTED';
      this.emitTransfersUpdate();
    }
  }

  private handleFileCancel(transferId: string) {
    const transfer = this.transfers[transferId];
    if (transfer && (transfer.state === 'TRANSFERRING' || transfer.state === 'OFFERED')) {
      transfer.state = 'CANCELLED';
      transfer.error = 'Cancelled by remote peer';
      this.activeSenders.set(transferId, false); // stop sender loop
      this.emitTransfersUpdate();
    }
  }

  private handleFileCompleteMsg(transferId: string) {
    const transfer = this.transfers[transferId];
    if (transfer && transfer.state === 'TRANSFERRING') {
      transfer.state = 'COMPLETED';
      transfer.completedAt = Date.now();
      this.activeSenders.set(transferId, false);
      this.emitTransfersUpdate();
    }
  }

  private handleFileErrorMsg(transferId: string, error: string) {
    const transfer = this.transfers[transferId];
    if (transfer && transfer.state === 'TRANSFERRING') {
      transfer.state = 'FAILED';
      transfer.error = error;
      this.activeSenders.set(transferId, false);
      this.emitTransfersUpdate();
    }
  }

  private async startFileTransferLoop(transferId: string, file: File) {
    this.activeSenders.set(transferId, true);
    logger.log('webrtc.file.start', { transferId });

    let offset = 0;
    const transferIdBytes = new TextEncoder().encode(transferId.padEnd(TRANSFER_ID_LENGTH, ' '));

    while (offset < file.size && this.activeSenders.get(transferId)) {
      if (this.state !== 'OPEN' || !this.channel) {
        this.cancelFile(transferId, 'Connection closed');
        break;
      }

      if (this.channel.bufferedAmount > HIGH_WATERMARK) {
        await this.waitForBufferLow();
        continue;
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await chunk.arrayBuffer();
      
      const messageBuffer = new Uint8Array(TRANSFER_ID_LENGTH + arrayBuffer.byteLength);
      messageBuffer.set(transferIdBytes, 0);
      messageBuffer.set(new Uint8Array(arrayBuffer), TRANSFER_ID_LENGTH);

      try {
        this.channel.send(messageBuffer);
        offset += arrayBuffer.byteLength;
        
        const transfer = this.transfers[transferId];
        if (transfer) {
          transfer.receivedBytes = offset;
          // UI throttling logic should be in React hook, so we just emit
          if (offset === file.size || (offset % (CHUNK_SIZE * 10)) === 0) {
            this.emitTransfersUpdate();
          }
        }
      } catch (err) {
        console.error('Error sending chunk:', err);
        this.cancelFile(transferId, 'Error sending data');
        break;
      }
    }
  }

  private waitForBufferLow(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.channel) {
        resolve();
        return;
      }
      if (this.channel.bufferedAmount <= LOW_WATERMARK) {
        resolve();
        return;
      }
      
      const listener = () => {
        this.channel?.removeEventListener('bufferedamountlow', listener);
        resolve();
      };
      this.channel.addEventListener('bufferedamountlow', listener);
      
      // Fallback in case event doesn't fire
      setTimeout(() => {
        this.channel?.removeEventListener('bufferedamountlow', listener);
        resolve();
      }, 500);
    });
  }

  private sendJSON(msg: DataMessage) {
    if (this.state !== 'OPEN' || !this.channel) return;
    this.channel.send(JSON.stringify(msg));
  }

  public cleanup() {
    if (this.channel) {
      this.channel.onopen = null;
      this.channel.onclose = null;
      this.channel.onerror = null;
      this.channel.onmessage = null;
      this.channel.onbufferedamountlow = null;
      if (this.channel.readyState !== 'closed') {
        this.channel.close();
      }
      this.channel = null;
    }
    this.updateState('CLOSED');
    this.activeSenders.clear();
    
    // Revoke object URLs to avoid memory leaks
    for (const t of Object.values(this.transfers)) {
      if (t.objectUrl) {
        URL.revokeObjectURL(t.objectUrl);
      }
    }
    this.transfers = {};
    this.emitTransfersUpdate();
  }
}
