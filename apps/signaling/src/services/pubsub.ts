import { createClient } from 'redis';
import { connectedClients, userSockets } from '../websocket';
import { WebSocket } from 'ws';

let publisher: ReturnType<typeof createClient>;
let subscriber: ReturnType<typeof createClient>;
let instanceId: string;

export async function initPubSub(redisUrl: string, id: string) {
  instanceId = id;
  
  publisher = createClient({ url: redisUrl });
  subscriber = createClient({ url: redisUrl });
  
  publisher.on('error', (err) => console.error('Redis Publisher Error', err));
  subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));
  
  await publisher.connect();
  await subscriber.connect();
  
  const channel = `signaling:instance:${instanceId}`;
  
  await subscriber.subscribe(channel, (message) => {
    try {
      const parsed = JSON.parse(message);
      const { targetUserId, payload } = parsed;
      
      const socketId = userSockets.get(targetUserId);
      if (socketId) {
        const ws = connectedClients.get(socketId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        }
      }
    } catch (err) {
      console.error('Failed to process pubsub message', err);
    }
  });
  
  console.log(`Subscribed to pubsub channel: ${channel}`);
}

export async function publishToInstance(targetInstanceId: string, targetUserId: string, payload: any) {
  if (!publisher) return;
  const channel = `signaling:instance:${targetInstanceId}`;
  await publisher.publish(channel, JSON.stringify({
    targetUserId,
    payload
  }));
}

export async function closePubSub() {
  if (subscriber) await subscriber.quit();
  if (publisher) await publisher.quit();
}
