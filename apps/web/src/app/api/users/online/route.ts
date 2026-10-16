import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all presence keys from Redis
    const keys = await redis.keys('presence:user:*');
    
    if (keys.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const userIds = keys.map(key => key.replace('presence:user:', ''));
    
    // Filter out the current user
    const otherUserIds = userIds.filter(id => id !== session.userId);

    if (otherUserIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Fetch user details from DB
    const users = await prisma.user.findMany({
      where: {
        id: { in: otherUserIds }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to get online users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
