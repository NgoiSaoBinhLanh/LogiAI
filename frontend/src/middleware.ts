import { NextRequest, NextResponse } from 'next/server';
import { isRouteAllowed, PUBLIC_ROUTES } from './lib/rbac-routes';

interface CompactRbacCookie {
  uid: string;
  roles: string[];
  perms: string[];
  ver: number;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/' ||
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  const rawCookie = request.cookies.get('logai_rbac')?.value;
  if (!rawCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawCookie)) as CompactRbacCookie;
    const allowed = isRouteAllowed(pathname, parsed.roles || [], parsed.perms || []);

    if (!allowed) {
      return NextResponse.rewrite(new URL('/forbidden', request.url), { status: 403 });
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
