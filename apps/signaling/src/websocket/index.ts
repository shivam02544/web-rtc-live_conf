import { WebSocket, WebSocketServer } from 'ws';
import { verifyToken } from '../services/auth';
import { setUserOnline, setUserOffline, getUserPresence, pingUser } from '../services/presence';
import { createCall, getCall, updateCallState, endCall, getUserActiveCall, acquireCallLock, releaseCallLock } from '../services/calls';
import { publishToInstance } from '../services/pubsub';
import { validateSignalingMessage } from '@video-call/shared';

export const connectedClients = new Map<string, WebSocket>();
export const userSockets = new Map<string, string>(); // userId -> socketId

interface RateLimitState {
  messageCount: number;
  lastReset: number;
}

const rateLimits = new Map<string, RateLimitState>();

function checkRateLimit(socketId: string, limit: number = 50, windowMs: number = 1000): boolean {
  const now = Date.now();
  const state = rateLimits.get(socketId);
  
  if (!state || now - state.lastReset > windowMs) {
    rateLimits.set(socketId, { messageCount: 1, lastReset: now });
    return true;
  }
  
  if (state.messageCount >= limit) {
    return false;
  }
  
  state.messageCount++;
  return true;
}

function cleanupRateLimits() {
  const now = Date.now();
  for (const [socketId, state] of rateLimits.entries()) {
    if (now - state.lastReset > 60000) { // Clean up old entries after 1 minute
      rateLimits.delete(socketId);
    }
  }
}

// Clean up rate limits periodically
setInterval(cleanupRateLimits, 60000);

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    const socketId = crypto.randomUUID();
    let currentUserId: string | null = null;
    let isAlive = true;

    ws.on('pong', () => {
      isAlive = true;
    });

    console.log('WebSocket connected:', socketId);

    const sendToUser = async (userId: string, msg: Record<string, unknown>): Promise<boolean> => {
      try {
        const targetSocketId = userSockets.get(userId);
        if (targetSocketId) {
          const targetWs = connectedClients.get(targetSocketId);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify(msg));
            return true;
          }
        }
        
        // If not local, check presence for instance routing
        const targetPresence = await getUserPresence(userId);
        if (targetPresence && targetPresence.instanceId) {
          await publishToInstance(targetPresence.instanceId, userId, msg);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error sending to user:', error);
        return false;
      }
    };

    const sendError = (error: string, code?: string) => {
      ws.send(JSON.stringify({ type: 'ERROR', error, code }));
    };

    ws.on('message', async (data) => {
      try {
        // Rate limiting
        if (!checkRateLimit(socketId)) {
          console.warn(`Rate limit exceeded for socket ${socketId}`);
          sendError('Rate limit exceeded', 'RATE_LIMIT');
          return;
        }

        // Parse and validate message
        const rawMessage = JSON.parse(data.toString());
        const message = validateSignalingMessage(rawMessage);
        
        if (!message) {
          console.error('Invalid message format:', rawMessage);
          sendError('Invalid message format', 'INVALID_MESSAGE');
          return;
        }
        
        // Handle unauthenticated state
        if (!currentUserId) {
          if (message.type === 'AUTH') {
            const payload = await verifyToken(message.token);
            if (payload) {
              currentUserId = payload.userId;
              connectedClients.set(socketId, ws);
              userSockets.set(currentUserId, socketId);
              await setUserOnline(currentUserId, socketId);
              ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId: currentUserId, name: payload.name }));
              
              // Reconcile call state
              const activeCallId = await getUserActiveCall(currentUserId);
              if (activeCallId) {
                const call = await getCall(activeCallId);
                if (call && call.state !== 'ENDED') {
                  const peerId = call.caller === currentUserId ? call.receiver : call.caller;
                  ws.send(JSON.stringify({
                    type: 'CALL_RECONCILE',
                    callId: activeCallId,
                    state: call.state,
                    peerId
                  }));
                }
              }
            } else {
              sendError('Invalid token', 'AUTH_FAILED');
              ws.close();
            }
          } else {
            sendError('Not authenticated', 'NOT_AUTHENTICATED');
          }
          return;
        }

        // Handle authenticated messages
        if (message.type === 'PING') {
          await pingUser(currentUserId);
          ws.send(JSON.stringify({ type: 'PONG' }));
          return;
        }

        switch (message.type) {
          case 'CALL_REQUEST': {
            if (message.to === currentUserId) {
              sendError('You cannot call yourself', 'INVALID_TARGET');
              return;
            }

            const callerActiveCall = await getUserActiveCall(currentUserId);
            const targetActiveCall = await getUserActiveCall(message.to);
            const targetPresence = await getUserPresence(message.to);
            if (callerActiveCall || targetActiveCall || !targetPresence) {
              ws.send(JSON.stringify({
                type: targetPresence ? 'USER_BUSY' : 'USER_NOT_FOUND',
                ...(targetPresence ? { callId: targetActiveCall || callerActiveCall || 'busy' } : { to: message.to })
              }));
              return;
            }

            const lockAcquired = await acquireCallLock(message.to);
            if (!lockAcquired) {
              ws.send(JSON.stringify({ type: 'USER_BUSY', callId: 'busy' }));
              return;
            }

            const callId = crypto.randomUUID();
            await createCall(callId, currentUserId, message.to);
            const delivered = await sendToUser(message.to, {
              type: 'INCOMING_CALL',
              callId,
              from: currentUserId,
              fromName: 'Someone'
            });

            if (!delivered) await endCall(callId);
            break;
          }

          case 'CALL_ACCEPT': {
            const call = await getCall(message.callId);
            if (!call || call.receiver !== currentUserId || call.state === 'ENDED') {
              sendError('Call is no longer available', 'CALL_NOT_FOUND');
              return;
            }
            await updateCallState(message.callId, 'ACCEPTED');
            await sendToUser(call.caller, message);
            break;
          }

          case 'CALL_OFFER': {
            const call = await getCall(message.callId);
            if (!call || call.state === 'ENDED') {
              sendError('Call not found', 'CALL_NOT_FOUND');
              return;
            }
            
            if (call.caller !== currentUserId && call.receiver !== currentUserId) {
              sendError('Not authorized for this call', 'UNAUTHORIZED');
              return;
            }
            
            await updateCallState(message.callId, 'NEGOTIATING');
            const targetUserId = call.caller === currentUserId ? call.receiver : call.caller;
            await sendToUser(targetUserId, message);
            break;
          }

          case 'CALL_ANSWER': {
            const call = await getCall(message.callId);
            if (!call || call.state === 'ENDED') {
              sendError('Call not found', 'CALL_NOT_FOUND');
              return;
            }
            
            if (call.receiver !== currentUserId) {
              sendError('Not authorized to answer this call', 'UNAUTHORIZED');
              return;
            }
            
            await updateCallState(message.callId, 'ACCEPTED');
            await sendToUser(call.caller, message);
            break;
          }

          case 'ICE_CANDIDATE': {
            const call = await getCall(message.callId);
            if (!call || call.state === 'ENDED') return;
            
            if (call.caller !== currentUserId && call.receiver !== currentUserId) {
              sendError('Not authorized for this call', 'UNAUTHORIZED');
              return;
            }
            
            const targetUserId = call.caller === currentUserId ? call.receiver : call.caller;
            await sendToUser(targetUserId, message);
            break;
          }

          case 'CALL_REJECT': {
            const call = await getCall(message.callId);
            if (!call || call.state === 'ENDED' || call.state === 'REJECTED') return;
            
            if (call.receiver !== currentUserId) {
              sendError('Not authorized to reject this call', 'UNAUTHORIZED');
              return;
            }
            
            await updateCallState(message.callId, 'REJECTED');
            await endCall(message.callId);
            await sendToUser(call.caller, { type: 'CALL_REJECT', callId: message.callId, reason: message.reason });
            break;
          }

          case 'CALL_END': {
            console.log('Received CALL_END from', currentUserId);
            const call = await getCall(message.callId);
            
            if (!call) {
              console.log('Call not found:', message.callId);
              return;
            }
            
            if (call.caller !== currentUserId && call.receiver !== currentUserId) {
              sendError('Not authorized for this call', 'UNAUTHORIZED');
              return;
            }
            
            if (call.state === 'ENDED') {
              console.log('Call already ended:', message.callId);
              return;
            }
            
            await endCall(message.callId);
            const targetUserId = call.caller === currentUserId ? call.receiver : call.caller;
            await sendToUser(targetUserId, { type: 'CALL_END', callId: message.callId });
            break;
          }

          case 'ICE_RESTART': {
            const call = await getCall(message.callId);
            if (!call || call.state === 'ENDED') {
              sendError('Call not found', 'CALL_NOT_FOUND');
              return;
            }
            
            if (call.caller !== currentUserId && call.receiver !== currentUserId) {
              sendError('Not authorized for this call', 'UNAUTHORIZED');
              return;
            }
            
            const targetUserId = call.caller === currentUserId ? call.receiver : call.caller;
            await sendToUser(targetUserId, message);
            break;
          }
        }
      } catch (err) {
        console.error('Message handling error:', err);
        sendError('Internal server error', 'INTERNAL_ERROR');
      }
    });

    ws.on('close', async () => {
      if (currentUserId) {
        connectedClients.delete(socketId);
        rateLimits.delete(socketId);
        
        // If the socket in the map is still OUR socket, remove it
        if (userSockets.get(currentUserId) === socketId) {
          userSockets.delete(currentUserId);
          await setUserOffline(currentUserId);

          // Delayed cleanup to allow for brief network reconnects
          const offlineUserId = currentUserId;
          setTimeout(async () => {
            if (!userSockets.has(offlineUserId)) {
              // User is still offline after 15 seconds, end their active call
              const activeCallId = await getUserActiveCall(offlineUserId);
              if (activeCallId) {
                const call = await getCall(activeCallId);
                if (call && call.state !== 'ENDED') {
                  const targetUserId = call.caller === offlineUserId ? call.receiver : call.caller;
                  await sendToUser(targetUserId, { type: 'CALL_END', callId: activeCallId });
                  await endCall(activeCallId);
                }
              }
            }
          }, 15000);
        }
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', socketId, error);
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (!isAlive) {
        console.log('WebSocket heartbeat failed, terminating:', socketId);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('close', () => {
      clearInterval(heartbeat);
    });
  });
}
