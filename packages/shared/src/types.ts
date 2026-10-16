export type SignalingMessage =
  | { type: 'AUTH'; token: string }
  | { type: 'AUTH_SUCCESS'; userId: string }
  | { type: 'AUTH_ERROR'; error: string }
  | { type: 'CALL_REQUEST'; to: string }
  | { type: 'INCOMING_CALL'; callId: string; from: string; fromName: string }
  | { type: 'CALL_ACCEPT'; callId: string }
  | { type: 'CALL_REJECT'; callId: string; reason?: string }
  | { type: 'CALL_OFFER'; callId: string; from: string; to: string; payload: any } // RTCSessionDescriptionInit
  | { type: 'CALL_ANSWER'; callId: string; payload: any } // RTCSessionDescriptionInit
  | { type: 'ICE_CANDIDATE'; callId: string; payload: any } // RTCIceCandidateInit
  | { type: 'CALL_END'; callId: string }
  | { type: 'USER_BUSY'; callId: string }
  | { type: 'USER_NOT_FOUND'; to: string }
  | { type: 'PONG' }
  | { type: 'PING' }
  | { type: 'CALL_RECONCILE'; callId: string; state: string; peerId: string };
