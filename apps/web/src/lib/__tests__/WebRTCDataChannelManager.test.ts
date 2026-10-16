import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebRTCDataChannelManager } from '../WebRTCDataChannelManager';
import { PROTOCOL_VERSION } from '../DataChannelProtocol';

// Mock RTCDataChannel
class MockRTCDataChannel {
  readyState = 'open';
  binaryType = 'blob';
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  
  onopen: any;
  onclose: any;
  onerror: any;
  onmessage: any;
  onbufferedamountlow: any;

  send = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

describe('WebRTCDataChannelManager', () => {
  let manager: WebRTCDataChannelManager;
  let mockChannel: any;
  let options: any;

  beforeEach(() => {
    options = {
      userId: 'test-user-123',
      onStateChange: vi.fn(),
      onChatMessage: vi.fn(),
      onFileTransferUpdate: vi.fn(),
      onError: vi.fn()
    };
    manager = new WebRTCDataChannelManager(options);
    mockChannel = new MockRTCDataChannel();
    manager.attachChannel(mockChannel as any);
    options.onStateChange.mockClear();
    options.onFileTransferUpdate.mockClear();
    options.onChatMessage.mockClear();
  });

  it('validates and parses valid chat messages', () => {
    const validMessage = JSON.stringify({
      version: PROTOCOL_VERSION,
      id: 'msg-1',
      type: 'chat.message',
      timestamp: Date.now(),
      senderId: 'remote-user',
      text: 'Hello world'
    });

    mockChannel.onmessage({ data: validMessage });
    
    expect(options.onChatMessage).toHaveBeenCalledTimes(1);
    expect(options.onChatMessage.mock.calls[0][0].text).toBe('Hello world');
  });

  it('rejects malformed messages', () => {
    mockChannel.onmessage({ data: 'invalid json' });
    expect(options.onChatMessage).not.toHaveBeenCalled();

    mockChannel.onmessage({ data: JSON.stringify({ version: 999, type: 'chat.message' }) }); // bad version
    expect(options.onChatMessage).not.toHaveBeenCalled();
  });

  it('handles outgoing file offers securely', () => {
    const fakeFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(fakeFile, 'size', { value: 50 * 1024 * 1024 }); // 50MB
    
    manager.sendFileOffer(fakeFile);
    
    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    const sentStr = mockChannel.send.mock.calls[0][0];
    const sentObj = JSON.parse(sentStr);
    
    expect(sentObj.type).toBe('file.offer');
    expect(sentObj.payload.name).toBe('test.txt');
    expect(sentObj.payload.size).toBe(50 * 1024 * 1024);
    
    expect(options.onFileTransferUpdate).toHaveBeenCalled();
  });

  it('rejects outgoing files that exceed size limit', () => {
    const fakeFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(fakeFile, 'size', { value: 150 * 1024 * 1024 }); // 150MB > 100MB
    
    expect(() => manager.sendFileOffer(fakeFile)).toThrow(/too large/);
    expect(mockChannel.send).not.toHaveBeenCalled();
  });

  it('sanitizes incoming file names', () => {
    const msg = JSON.stringify({
      version: PROTOCOL_VERSION,
      id: 'msg-2',
      type: 'file.offer',
      payload: {
        transferId: 'transfer-1',
        name: '../../../etc/passwd',
        size: 1024,
        mimeType: 'text/plain'
      }
    });

    mockChannel.onmessage({ data: msg });
    
    expect(options.onFileTransferUpdate).toHaveBeenCalledTimes(1);
    const transfers = options.onFileTransferUpdate.mock.calls[0][0];
    expect(transfers['transfer-1'].fileName).toBe('.........etcpasswd'); // Sanitized
  });
});
