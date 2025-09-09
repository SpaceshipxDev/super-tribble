import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, parseSessionValue } from '@/lib/auth';

const PUBLIC_PATHS: Array<RegExp> = [
  /^\/login(?:$|\?)/,
  /^\/api\/auth\/(login|logout|me)(?:$|\/)/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/.*\.(?:svg|png|jpg|jpeg|gif|ico|txt|json|js|css|map)$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const xfHost = req.headers.get('x-forwarded-host');
  const host = xfHost || req.headers.get('host') || req.nextUrl.host;
  const xfProto = req.headers.get('x-forwarded-proto');
  const proto = xfProto || req.nextUrl.protocol.replace(':', '') || 'http';
  const base = `${proto}://${host}`;
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);

  // If user is already logged in and visits /login, redirect to the appropriate landing
  if (pathname.startsWith('/login')) {
    if (user === 'admin') {
      const url = new URL('/admin', base);
      return NextResponse.redirect(url);
    }
    if (user) {
      const url = new URL('/', base);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Admin-only routes
  if (pathname.startsWith('/metrics') || pathname.startsWith('/admin')) {
    if (user !== 'admin') {
      const url = new URL('/', req.url);
      return NextResponse.redirect(url);
    }
    // If admin, proceed
    return NextResponse.next();
  }

  // Redirect admin away from chat UI to admin dashboard
  if (pathname === '/' && user === 'admin') {
    const url = new URL('/admin', req.url);
    return NextResponse.redirect(url);
  }

  if (user) return NextResponse.next();

  // API requests: return 401 JSON
  if (pathname.startsWith('/api/')) {
    return new NextResponse(JSON.stringify({ error: '未登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pages: redirect to login
  const url = new URL('/login', base);
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
