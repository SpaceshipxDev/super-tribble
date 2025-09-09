import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isHttps = forwardedProto ? forwardedProto === 'https' : req.nextUrl.protocol === 'https:';
  const secure = process.env.NODE_ENV === 'production' ? isHttps : false;
  res.cookies.set(AUTH_COOKIE, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 0,
  });
  return res;
}
