import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import crypto from 'crypto';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stunServer = process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302';
    
    const iceServers: RTCIceServer[] = [
      { urls: [stunServer] }
    ];

    const turnServer = process.env.TURN_SERVER;
    const turnSecret = process.env.TURN_SECRET;
    
    if (turnServer) {
      if (turnSecret) {
        // Generate short-lived TURN credentials using HMAC-SHA1
        // Format: timestamp:username
        const expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // 24 hours
        const username = `${expiry}:${session.userId}`;
        
        const hmac = crypto.createHmac('sha1', turnSecret);
        hmac.update(username);
        const credential = hmac.digest('base64');
        
        iceServers.push({
          urls: turnServer.split(','),
          username,
          credential
        });
      } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
        // Fallback to static credentials if secret is not provided
        iceServers.push({
          urls: turnServer.split(','),
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_CREDENTIAL
        });
      }
    }

    return NextResponse.json({ iceServers });
  } catch (error) {
    console.error('Failed to generate ICE servers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
