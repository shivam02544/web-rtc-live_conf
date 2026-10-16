import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../src/server';
import * as jose from 'jose';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:56379';
const JWT_SECRET = process.env.AUTH_SECRET || 'dev_secret_key';

async function generateToken(userId: string) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new jose.SignJWT({ userId, name: `User ${userId}` })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
}

describe('Distributed Signaling', () => {
  let server1: any;
  let server2: any;

  beforeAll(async () => {
    const res1 = await startServer(8085, REDIS_URL, 'instance-1');
    server1 = res1.server;
    const res2 = await startServer(8086, REDIS_URL, 'instance-2');
    server2 = res2.server;
  });

  afterAll(async () => {
    if (server1) server1.close();
    if (server2) server2.close();
    // Allow time for shutdown
    await new Promise(r => setTimeout(r, 1000));
  });

  it('routes messages across instances via pubsub', async () => {
    const tokenA = await generateToken('userA');
    const tokenB = await generateToken('userB');

    const wsA = new WebSocket('ws://localhost:8085');
    const wsB = new WebSocket('ws://localhost:8086');

    let wsAAuth = false;
    let wsBAuth = false;
    let bReceivedCall = false;

    wsA.on('open', () => {
      wsA.send(JSON.stringify({ type: 'AUTH', token: tokenA }));
    });
    wsB.on('open', () => {
      wsB.send(JSON.stringify({ type: 'AUTH', token: tokenB }));
    });

    wsA.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'AUTH_SUCCESS') wsAAuth = true;
    });

    wsB.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'AUTH_SUCCESS') wsBAuth = true;
      if (msg.type === 'INCOMING_CALL') {
        bReceivedCall = true;
      }
    });

    // Wait for auth
    await new Promise(r => setTimeout(r, 1000));
    expect(wsAAuth).toBe(true);
    expect(wsBAuth).toBe(true);

    // A calls B
    wsA.send(JSON.stringify({ type: 'CALL_REQUEST', to: 'userB' }));

    // Wait for call delivery across instances
    await new Promise(r => setTimeout(r, 1000));
    expect(bReceivedCall).toBe(true);

    wsA.close();
    wsB.close();
  });
});
