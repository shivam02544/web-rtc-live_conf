import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;
let currentInstanceId: string;

export function initPresence(client: RedisClientType, instanceId: string): void {
  redisClient = client;
  currentInstanceId = instanceId;
}

export async function setUserOnline(userId: string, socketId: string): Promise<void> {
  const key = `presence:user:${userId}`;
  await redisClient.hSet(key, {
    socketId,
    status: 'online',
    instanceId: currentInstanceId,
    lastSeen: Date.now().toString(),
  });
  
  // Add to instance's local user set for cleanup
  await redisClient.sAdd(`presence:instance:${currentInstanceId}`, userId);
  await redisClient.expire(`presence:instance:${currentInstanceId}`, 120);
  
  // Set an expiry to auto-cleanup if the server crashes without disconnecting properly
  await redisClient.expire(key, 60); // 60 seconds
}

export async function setUserOffline(userId: string): Promise<void> {
  const key = `presence:user:${userId}`;
  await redisClient.del(key);
  await redisClient.sRem(`presence:instance:${currentInstanceId}`, userId);
}

export async function pingUser(userId: string): Promise<void> {
  const key = `presence:user:${userId}`;
  const exists = await redisClient.exists(key);
  if (exists) {
    await redisClient.hSet(key, 'lastSeen', Date.now().toString());
    await redisClient.expire(key, 60);
  }
}

export async function getUserPresence(userId: string): Promise<Record<string, string> | null> {
  const key = `presence:user:${userId}`;
  const data = await redisClient.hGetAll(key);
  if (Object.keys(data).length === 0) return null;
  return data;
}

export async function clearInstancePresence(): Promise<void> {
  if (!currentInstanceId) return;
  const instanceKey = `presence:instance:${currentInstanceId}`;
  const users = await redisClient.sMembers(instanceKey);
  for (const userId of users) {
    await redisClient.del(`presence:user:${userId}`);
  }
  await redisClient.del(instanceKey);
}
