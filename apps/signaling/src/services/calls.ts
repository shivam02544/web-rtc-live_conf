import { RedisClientType } from 'redis';

let redisClient: RedisClientType;

export function initCalls(client: RedisClientType): void {
  redisClient = client;
}

export async function acquireCallLock(userId: string): Promise<boolean> {
  const lockKey = `lock:user:call:${userId}`;
  // Set NX (Only set if not exists), EX (Expire in seconds)
  const result = await redisClient.set(lockKey, 'locked', { NX: true, EX: 5 });
  return result === 'OK';
}

export async function releaseCallLock(userId: string): Promise<void> {
  const lockKey = `lock:user:call:${userId}`;
  await redisClient.del(lockKey);
}

export type CallState = 
  | 'IDLE' 
  | 'OUTGOING_CALL' 
  | 'RINGING' 
  | 'ACCEPTED' 
  | 'NEGOTIATING' 
  | 'CONNECTING' 
  | 'CONNECTED' 
  | 'ENDING' 
  | 'ENDED'
  | 'REJECTED'
  | 'BUSY'
  | 'TIMEOUT'
  | 'FAILED'
  | 'DISCONNECTED';

export interface CallData {
  id: string;
  caller: string;
  receiver: string;
  state: CallState;
  createdAt: string;
}

export async function createCall(callId: string, caller: string, receiver: string): Promise<CallData> {
  const call: CallData = {
    id: callId,
    caller,
    receiver,
    state: 'OUTGOING_CALL',
    createdAt: Date.now().toString()
  };
  
  // Store call data with proper typing
  await redisClient.hSet(`call:${callId}`, {
    id: call.id,
    caller: call.caller,
    receiver: call.receiver,
    state: call.state,
    createdAt: call.createdAt
  });
  
  // Link users to call with standardized naming
  await redisClient.set(`user:call:${caller}`, callId);
  await redisClient.set(`user:call:${receiver}`, callId);
  
  // Set expiry for all keys
  await redisClient.expire(`call:${callId}`, 3600); // Max 1 hour
  await redisClient.expire(`user:call:${caller}`, 3600);
  await redisClient.expire(`user:call:${receiver}`, 3600);
  
  return call;
}

export async function getCall(callId: string): Promise<CallData | null> {
  const data = await redisClient.hGetAll(`call:${callId}`);
  if (Object.keys(data).length === 0) return null;
  
  // Properly type the return value
  return {
    id: data.id,
    caller: data.caller,
    receiver: data.receiver,
    state: data.state as CallState,
    createdAt: data.createdAt
  };
}

export async function updateCallState(callId: string, state: CallState): Promise<void> {
  await redisClient.hSet(`call:${callId}`, 'state', state);
}

export async function endCall(callId: string): Promise<void> {
  const call = await getCall(callId);
  if (call) {
    await updateCallState(callId, 'ENDED');
    await redisClient.del(`user:call:${call.caller}`);
    await redisClient.del(`user:call:${call.receiver}`);
    
    // Release any locks
    await releaseCallLock(call.caller);
    await releaseCallLock(call.receiver);
  }
}

export async function getUserActiveCall(userId: string): Promise<string | null> {
  return await redisClient.get(`user:call:${userId}`);
}
