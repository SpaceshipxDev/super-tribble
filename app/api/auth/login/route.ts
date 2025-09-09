import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, isAllowedUser, validatePassword, createSessionValue } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let username = '';
  let password = '';
  let nextPath = '/';
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const form = await req.formData();
    username = String(form.get('username') || '').trim();
    password = String(form.get('password') || '');
    nextPath = String(form.get('next') || '/') || '/';
  } else {
    try {
      const raw = (await req.json()) as unknown;
      const obj = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
      username = typeof obj.username === 'string' ? obj.username.trim() : '';
      password = typeof obj.password === 'string' ? obj.password : '';
      nextPath = typeof obj.next === 'string' ? obj.next : '/';
    } catch {}
  }

  if (!isAllowedUser(username)) {
    return NextResponse.json({ error: '无效的用户' }, { status: 401 });
  }
  if (!validatePassword(password)) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  const cookieValue = await createSessionValue(username);
  const res = NextResponse.redirect(new URL(nextPath || '/', req.url));
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isHttps = forwardedProto ? forwardedProto === 'https' : req.nextUrl.protocol === 'https:';
  const secure = process.env.NODE_ENV === 'production' ? isHttps : false;
  res.cookies.set(AUTH_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
