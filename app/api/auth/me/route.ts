import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, parseSessionValue } from '@/lib/auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}

