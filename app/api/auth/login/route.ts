import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, isAllowedUser, validatePassword, createSessionValue } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');

  if (!isAllowedUser(username)) {
    return NextResponse.json({ error: '无效的用户' }, { status: 401 });
  }
  if (!validatePassword(password)) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  const cookieValue = await createSessionValue(username);
  const res = NextResponse.json({ ok: true, user: username });
  res.cookies.set(AUTH_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Secure in production; left flexible for dev.
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

