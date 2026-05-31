import * as Sentry from '@sentry/nextjs';
import { redactSentryEvent } from '@/lib/security/sentry-redaction';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend: redactSentryEvent,
});
