export type DataChannelState = 'IDLE' | 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'FAILED';

export const PROTOCOL_VERSION = 1;

export type ChatMessage = {
  version: typeof PROTOCOL_VERSION;
  id: string;
  type: 'chat.message';
  timestamp: number;
  senderId: string;
  text: string;
};

export type FileOfferPayload = {
  transferId: string;
  name: string;
  size: number;
  mimeType: string;
  lastModified?: number;
};

export type FileOffer = {
  version: typeof PROTOCOL_VERSION;
  id: string;
  type: 'file.offer';
  payload: FileOfferPayload;
};

export type FileAccept = { version: typeof PROTOCOL_VERSION; id: string; type: 'file.accept'; transferId: string };
export type FileReject = { version: typeof PROTOCOL_VERSION; id: string; type: 'file.reject'; transferId: string };
export type FileCancel = { version: typeof PROTOCOL_VERSION; id: string; type: 'file.cancel'; transferId: string };
export type FileComplete = { version: typeof PROTOCOL_VERSION; id: string; type: 'file.complete'; transferId: string };
export type FileError = { version: typeof PROTOCOL_VERSION; id: string; type: 'file.error'; transferId: string; error: string };

export type PingMessage = { version: typeof PROTOCOL_VERSION; id: string; type: 'ping'; timestamp: number };
export type PongMessage = { version: typeof PROTOCOL_VERSION; id: string; type: 'pong'; timestamp: number };

export type DataMessage =
  | ChatMessage
  | FileOffer
  | FileAccept
  | FileReject
  | FileCancel
  | FileComplete
  | FileError
  | PingMessage
  | PongMessage;

// Binary Chunk Header Size: 36 bytes for UUID
export const TRANSFER_ID_LENGTH = 36;
export const CHUNK_SIZE = 16 * 1024; // 16 KB
export const LOW_WATERMARK = 64 * 1024; // 64 KB
export const HIGH_WATERMARK = 256 * 1024; // 256 KB
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_CHAT_MESSAGE_SIZE = 16 * 1024; // 16 KB
export const MAX_DATA_MESSAGE_SIZE = 32 * 1024; // 32 KB
export const MAX_ACTIVE_FILE_TRANSFERS = 2;
export const MAX_PENDING_FILE_OFFERS = 5;

export type FileTransferState = 'OFFERED' | 'ACCEPTED' | 'TRANSFERRING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' | 'FAILED';

export interface FileTransferSession {
  transferId: string;
  fileName: string;
  mimeType: string;
  expectedSize: number;
  receivedBytes: number;
  chunks: Uint8Array[];
  state: FileTransferState;
  startedAt: number;
  completedAt?: number;
  direction: 'incoming' | 'outgoing';
  file?: File; // For outgoing
  error?: string;
  objectUrl?: string; // For incoming completion
}
