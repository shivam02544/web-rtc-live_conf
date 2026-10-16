import { NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: session });
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ success: true });
}
