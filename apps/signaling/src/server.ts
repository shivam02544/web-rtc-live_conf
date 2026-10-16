import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';
import { initPresence, clearInstancePresence } from './services/presence';
import { initCalls } from './services/calls';
import { setupWebSocket } from './websocket';
import { initPubSub, closePubSub } from './services/pubsub';
import { getRedisUrl } from '@video-call/shared';

dotenv.config({ path: '../../.env' });

export const INSTANCE_ID = process.env.SIGNALING_INSTANCE_ID || `signal-${crypto.randomUUID().slice(0, 8)}`;
console.log(`Starting signaling instance: ${INSTANCE_ID}`);

const REDIS_URL = getRedisUrl();

// Global state management
let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
let isShuttingDown = false;
let isReady = false;

export async function startServer(port: number, redisUrl: string, instanceId: string) {
  const localRedis = createClient({ url: redisUrl }) as RedisClientType;
  localRedis.on('error', (err) => console.error('Redis Client Error', err));
  await localRedis.connect();
  
  initPresence(localRedis, instanceId);
  initCalls(localRedis);
  await initPubSub(redisUrl, instanceId);

  const app = express();
  app.use(cors());
  app.use(express.json());

  const httpServer = http.createServer(app);
  const wsServer = new WebSocketServer({ server: httpServer });
  
  // Store in global variables for graceful shutdown
  server = httpServer;
  wss = wsServer;

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', instance: instanceId, shuttingDown: isShuttingDown });
  });

  app.get('/ready', (req, res) => {
    if (isReady && !isShuttingDown) {
      res.status(200).json({ status: 'ready', instance: instanceId });
    } else {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.get('/metrics', (req, res) => {
    const memory = process.memoryUsage();
    res.json({
      instance: instanceId,
      activeWebSockets: wsServer.clients.size,
      uptime: process.uptime(),
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external
      }
    });
  });

  setupWebSocket(wsServer);

  return new Promise<{ server: http.Server; redis: RedisClientType }>((resolve) => {
    httpServer.listen(port, () => {
      isReady = true;
      resolve({ server: httpServer, redis: localRedis });
    });
  });
}

if (require.main === module) {
  const PORT = parseInt(process.env.SIGNALING_PORT || '8080', 10);
  (async () => {
    try {
      await startServer(PORT, REDIS_URL, INSTANCE_ID);
      console.log(`Signaling server running on port ${PORT}`);
    } catch (err) {
      console.error('Failed to start server', err);
      process.exit(1);
    }
  })();
}

// Graceful Shutdown
async function shutdown() {
  if (isShuttingDown) return;
  console.log('Graceful shutdown initiated...');
  isShuttingDown = true;
  isReady = false;

  if (!server || !wss) {
    console.log('Server not initialized, exiting...');
    process.exit(0);
    return;
  }

  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');
    try {
      // Close WebSockets
      for (const client of wss!.clients) {
        client.close(1001, 'Server shutting down');
      }
      
      // Cleanup local presence
      await clearInstancePresence();
      
      // Close Redis connections
      await closePubSub();
      
      console.log('Shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown', err);
      process.exit(1);
    }
  });

  // Force shutdown after 10s
  setTimeout(() => {
    console.error('Forcefully shutting down after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});
