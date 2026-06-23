import { INestApplication } from '@nestjs/common';

/**
 * Configures CORS on the given NestJS application.
 *
 * Allowed origins (single-tenant mode):
 *  1. Exact origins listed in CORS_ORIGINS (comma-separated env var)
 *  2. In non-production: standard local dev ports
 */
export function configureCors(app: INestApplication): void {
  const fixedAllowed = (process.env.CORS_ORIGINS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const devDefaults = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:5203', 'http://localhost:5204', 'http://localhost:5205'];
  const allowed = new Set([...fixedAllowed, ...devDefaults]);

  app.enableCors({
    origin: (requestOrigin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no Origin header (health checks, favicon, curl, etc.)
      if (!requestOrigin) {
        return cb(null, true);
      }
      if (allowed.has(requestOrigin)) return cb(null, true);
      return cb(new Error('origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // X-CSRF-Token is required by csrfMiddleware for cookie-based client
    // mutations (website is cross-origin: :5205 → :5200). Without it on the
    // allow-list the browser preflight strips the header and the mutation
    // fails (INFRA-030).
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
    // Expose the request id so the client can surface it in error messages for
    // support correlation.
    exposedHeaders: ['X-Request-ID'],
  });
}
