import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — Sawa Dashboard (Single-Tenant)
 *
 * Forwards the Host header for proxy requests.
 * Auth protection is handled entirely client-side by AuthGate.
 */

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const rawHost = req.headers.get('host') ?? '';

  const forwardHeaders = new Headers(req.headers);
  if (!forwardHeaders.has('x-forwarded-host')) {
    forwardHeaders.set('x-forwarded-host', rawHost);
  }

  return NextResponse.next({ request: { headers: forwardHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
    '/api/proxy/:path*',
  ],
};
