export type EventName = 
  | 'call.created'
  | 'call.accepted'
  | 'call.rejected'
  | 'call.timeout'
  | 'call.connected'
  | 'call.disconnected'
  | 'call.reconnecting'
  | 'call.reconnected'
  | 'call.failed'
  | 'call.ended'
  | 'webrtc.ice_checking'
  | 'webrtc.ice_connected'
  | 'webrtc.ice_failed'
  | 'webrtc.ice_restart'
  | 'websocket.connected'
  | 'websocket.disconnected'
  | 'websocket.reconnecting'
  | 'websocket.reconnected'
  | (string & {});

export const logger = {
  log: (event: EventName, metadata?: Record<string, unknown>) => {
    // Only log in development or if a logging endpoint is configured
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...metadata
    }));
  }
};
