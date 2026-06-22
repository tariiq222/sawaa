import * as Sentry from '@sentry/node';

// Header keys to scrub from request headers (case-insensitive match).
const SCRUBBED_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
]);

// Field name pattern: matches any key containing these substrings.
const SENSITIVE_FIELD_RE =
  /(password|otp|secret|apikey|api_key|token|authorization|nationalid|national_id|iqama|cvv|cardnumber|card_number|pan|webhooksecret|webhook_secret)/i;

// Signature-style header pattern (x-*-signature).
const SIGNATURE_HEADER_RE = /^x-.+-signature$/i;

/**
 * Scrubs PII from a Sentry event before it is sent to the DSN.
 * Exported for unit testing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scrubEvent(event: any): any {
  // Strip query string from request URL.
  if (event.request?.url) {
    try {
      const parsed = new URL(event.request.url);
      event.request.url = parsed.origin + parsed.pathname;
    } catch {
      // URL may be a path-only string — fall back to simple split.
      event.request.url = event.request.url.split('?')[0];
    }
  }

  // Scrub request headers.
  if (event.request?.headers && typeof event.request.headers === 'object') {
    for (const key of Object.keys(event.request.headers)) {
      const lower = key.toLowerCase();
      if (
        SCRUBBED_HEADER_KEYS.has(lower) ||
        SIGNATURE_HEADER_RE.test(lower)
      ) {
        event.request.headers[key] = '[redacted]';
      }
    }
  }

  // Scrub sensitive keys from request body.
  if (event.request?.data && typeof event.request.data === 'object') {
    scrubObject(event.request.data);
  }

  // Scrub sensitive keys from event.extra.
  if (event.extra && typeof event.extra === 'object') {
    scrubObject(event.extra);
  }

  return event;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scrubObject(obj: Record<string, any>): void {
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_FIELD_RE.test(key)) {
      obj[key] = '[redacted]';
    } else if (obj[key] && typeof obj[key] === 'object') {
      scrubObject(obj[key] as Record<string, unknown>);
    }
  }
}

// Initialise Sentry / GlitchTip error tracking.
// Must be imported as the very first module in main.ts (before NestFactory).
// If SENTRY_DSN is unset the call is a no-op so local dev works without config.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubEvent(event);
    },
  });
}

// ─── Global error handlers ─────────────────────────────────────────────────
// Catch promise rejections and synchronous exceptions that escape the Nest
// pipeline. Without these, an unhandled rejection in a BullMQ worker or a
// stray throw in a cron job leads to a silent crash. Both handlers report to
// Sentry (when configured) and log with the standard logger so it shows up in
// the same place as the rest of the application logs.
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[unhandledRejection]', reason instanceof Error ? (reason.stack ?? reason.message) : reason);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  }
});

process.on('uncaughtException', (err: Error) => {
  console.error('[uncaughtException]', err.stack ?? err.message);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  // Do not exit immediately: Nest's shutdown hooks (enabled in main.ts) will
  // close the HTTP server and BullMQ workers cleanly when the process is
  // reaped. A force-exit here would skip the in-flight request drain.
});
