import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { createMiddleware } from '@frontman-ai/nextjs';

/**
 * Middleware — Sawa Dashboard (Single-Tenant)
 *
 * Forwards the Host header for proxy requests.
 * Auth protection is handled entirely client-side by AuthGate.
 */

const frontman = createMiddleware({
  projectRoot: process.cwd(),
  sourceRoot: path.resolve(process.cwd(), '../..'),
});

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const response = await frontman(req);
  if (response) return response;

  const rawHost = req.headers.get('host') ?? '';

  const forwardHeaders = new Headers(req.headers);
  if (!forwardHeaders.has('x-forwarded-host')) {
    forwardHeaders.set('x-forwarded-host', rawHost);
  }

  return NextResponse.next({ request: { headers: forwardHeaders } });
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/frontman',
    '/frontman/:path*',
    '/:path*/frontman',
    '/:path*/frontman/',
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
    '/api/proxy/:path*',
  ],
};
