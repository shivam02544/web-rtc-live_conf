import { jwtVerify } from 'jose';
import { getAuthSecret } from '@video-call/shared';

const encodedKey = new TextEncoder().encode(getAuthSecret());

export async function verifyToken(token: string): Promise<{ userId: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    });
    
    // Validate payload structure
    if (!payload.userId || !payload.name) {
      return null;
    }
    
    return payload as { userId: string; name: string };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}
