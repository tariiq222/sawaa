import * as Joi from 'joi';

/**
 * Boot-time validation for process.env.
 *
 * Rules:
 * - Only variables declared here are trusted. Unknown keys pass through
 *   but are not validated.
 * - NestJS ConfigModule calls this schema once at startup and aborts the
 *   app if any required variable is missing or malformed.
 * - Keep this file flat: one Joi schema, no typed getters. Typed config
 *   namespaces are added per bounded context when that BC is implemented.
 *
 * Spec reference: apps/backend/.env.example
 */
export const envValidationSchema = Joi.object({
  // Runtime
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(5100),

  // CORS — comma-separated list of allowed origins.
  // In production MUST be set to the dashboard + mobile origins (no localhost).
  CORS_ORIGINS: Joi.string().allow('').optional(),

  // Database (Prisma)
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required()
    .custom((url: string, helpers) => {
      if (process.env.NODE_ENV === 'production') {
        try {
          const u = new URL(url);
          if (!u.searchParams.has('connection_limit')) {
            return helpers.error('any.invalid', { message: 'DATABASE_URL must include connection_limit in production' });
          }
          if (!u.searchParams.has('pool_timeout')) {
            return helpers.error('any.invalid', { message: 'DATABASE_URL must include pool_timeout in production' });
          }
        } catch {
          return helpers.error('any.invalid', { message: 'DATABASE_URL is not a valid URL' });
        }
      }
      return url;
    }, 'production pool config'),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().default(30_000),
  DB_POOL_TIMEOUT_S: Joi.number().integer().default(20),
  DB_CONNECTION_LIMIT: Joi.number().integer().default(10),
  APP_DB_USER: Joi.string().optional(),
  APP_DB_PASSWORD: Joi.string().optional(),

  // Redis (BullMQ + cache + token blacklist)
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().required(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),

  // MinIO (object storage)
  MINIO_ENDPOINT: Joi.string().hostname().required(),
  MINIO_PORT: Joi.number().port().required(),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET: Joi.string().required(),
  MINIO_USE_SSL: Joi.boolean().default(false),

  // JWT (Identity BC)
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  // Refresh tokens are opaque DB-stored tokens (bcrypt selector pattern); JWT_REFRESH_SECRET is reserved for future JWT-signed refresh token migration.
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  // Client JWT — separate namespace for website clients
  JWT_CLIENT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_CLIENT_ACCESS_TTL: Joi.string().default('15m'),

  // License Server (Platform BC) — optional until Phase 3
  LICENSE_SERVER_URL: Joi.string().uri().allow('').optional(),
  LICENSE_KEY: Joi.string().allow('').optional(),

  // FCM (Comms BC) — optional until Phase 9
  FCM_PROJECT_ID: Joi.string().allow('').optional(),
  FCM_CLIENT_EMAIL: Joi.string().email().allow('').optional(),
  FCM_PRIVATE_KEY: Joi.string().allow('').optional(),

  // SMTP (Comms BC) — optional until Phase 9
  SMTP_HOST: Joi.string().hostname().allow('').optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  SMTP_FROM: Joi.string().email().allow('').optional(),

  // OpenAI (AI BC — embeddings only) — optional until Phase 11
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  OPENAI_EMBEDDING_MODEL: Joi.string().default('text-embedding-3-small'),

  // OpenRouter (AI BC — chat/completion) — optional until Phase 11
  OPENROUTER_API_KEY: Joi.string().allow('').optional(),
  OPENROUTER_BASE_URL: Joi.string().uri().default('https://openrouter.ai/api/v1'),
  OPENROUTER_CHAT_MODEL: Joi.string().default('anthropic/claude-3.5-haiku'),

  // Per-tenant Moyasar AES-256-GCM key — REQUIRED; 32 raw bytes base64-encoded (ASCII length 44).
  // Used to wrap each tenant's MoyasarPublishableKey + secretKey at rest.
  MOYASAR_ENCRYPTION_KEY: Joi.string().base64().length(44).required(),

  // SMS per-tenant (SaaS-02g-sms) — encryption key is REQUIRED; 32 raw bytes base64-encoded (ASCII length 44).
  // Webhook base URL is the public origin registered with providers for DLR callbacks.
  SMS_PROVIDER_ENCRYPTION_KEY: Joi.string().base64().length(44).required(),
  ZOOM_PROVIDER_ENCRYPTION_KEY: Joi.string().base64().length(44).required(),
  // Email provider per-tenant encryption key — 32 raw bytes base64-encoded (ASCII length 44).
  EMAIL_PROVIDER_ENCRYPTION_KEY: Joi.string().base64().length(44).required(),
  SMS_WEBHOOK_URL_BASE: Joi.string().uri().allow('').optional(),

  // Super-admin bootstrap password. Must be changed before production.
  // Min 16 chars; placeholder values ('Admin@2026', 'admin', 'password') rejected in production.
  SUPER_ADMIN_PASSWORD: Joi.string().min(16).when('NODE_ENV', {
    is: 'production',
    then: Joi.required().disallow('Admin@2026', 'admin', 'password'),
    otherwise: Joi.string().min(16).allow('').optional(),
  }),

  // Throttle kill-switch. Must NEVER be enabled in production.
  THROTTLER_DISABLED: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('false').default('false'),
    otherwise: Joi.string().valid('true', 'false').default('false'),
  }),

  // OTP bypass flags — dev/test only, MUST never be enabled in production.
  MOBILE_OTP_FULL_BYPASS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('false').default('false'),
    otherwise: Joi.string().valid('true', 'false').default('false'),
  }),
  MOBILE_OTP_DEV_BYPASS_CODE: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.forbidden(),
    otherwise: Joi.string().allow('').optional(),
  }),

  // Dedicated OTP-token secret. Falls back to JWT_ACCESS_SECRET in dev with a
  // warning; production REQUIRES a distinct secret so a leaked OTP token
  // cannot forge an access token.
  JWT_OTP_SECRET: Joi.when('NODE_ENV', {
    is: Joi.string().valid('development', 'test'),
    then: Joi.string().min(16).allow('').optional(),
    otherwise: Joi.string().min(16).required(),
  }),

  // Client refresh-token TTL (mobile + website). String like '7d' / '30d'.
  JWT_CLIENT_REFRESH_TTL: Joi.string().default('7d'),

  // Public URLs used in emails/notifications/redirects. Must be HTTPS in prod.
  DASHBOARD_PUBLIC_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri({ scheme: ['https'] }).required(),
    otherwise: Joi.string().uri().allow('').optional(),
  }),
  // Public origin of the backend itself (where third-party webhooks
  // will POST to). Distinct from DASHBOARD_PUBLIC_URL: the dashboard and the
  // API typically live on different subdomains (app.sawaa.app vs api.sawaa.app)
  // and only the API origin is reachable by external services.
  API_PUBLIC_URL: Joi.when('NODE_ENV', {
      is: 'production',
      then: Joi.string().uri({ scheme: ['https'] }).required(),
      otherwise: Joi.string().uri().allow('').optional(),
    }),
  PUBLIC_WEBSITE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri({ scheme: ['https'] }).required(),
    otherwise: Joi.string().uri().allow('').optional(),
  }),

  // Authentica platform OTP — REQUIRED in prod since OTP is the primary mobile/website
  // login mechanism. https://portal.authentica.sa/settings/apikeys/
  AUTHENTICA_API_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(8).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  AUTHENTICA_BASE_URL: Joi.string().uri().default('https://api.authentica.sa'),
  AUTHENTICA_DEFAULT_TEMPLATE_ID: Joi.string().default('1'),

  INTERNAL_METRICS_ALLOWED_IPS: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('127.0.0.1,::1'),
  }),
  INTERNAL_METRICS_TOKEN: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow('').optional(),
  }),

})
  .unknown(true)
  // Production safety net: refuse to boot if any sensitive value is still a
  // dev placeholder. The strings here are the literal dev defaults committed
  // to .env.example. If any of them slip into production, fail fast — a
  // running app with a known JWT secret is far worse than a non-running app.
  .custom((value, helpers) => {
    if (value.NODE_ENV !== 'production') return value;
    const placeholderSubstrings = ['change-me', 'CHANGE_ME', 'REPLACE_ME', 'dev-', 'sk_test_'];
    const sensitiveKeys = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_OTP_SECRET',
      'JWT_CLIENT_ACCESS_SECRET',
      'SMS_PROVIDER_ENCRYPTION_KEY',
      'ZOOM_PROVIDER_ENCRYPTION_KEY',
      'MOYASAR_ENCRYPTION_KEY',
      'EMAIL_PROVIDER_ENCRYPTION_KEY',
      'AUTHENTICA_API_KEY',
    ];
    for (const key of sensitiveKeys) {
      const v = value[key];
      if (typeof v !== 'string' || v.length === 0) continue;
      if (placeholderSubstrings.some((p) => v.includes(p))) {
        return helpers.error('any.invalid', {
          message: `${key} contains a dev placeholder and must be replaced before running in production`,
        });
      }
    }
    // Reject known bootstrap default for super-admin password
    if (typeof value.SUPER_ADMIN_PASSWORD === 'string') {
      const banned = ['Admin@2026', 'admin', 'password'];
      if (banned.includes(value.SUPER_ADMIN_PASSWORD)) {
        return helpers.error('any.invalid', {
          message: 'SUPER_ADMIN_PASSWORD is set to a known dev default and must be changed before running in production',
        });
      }
    }
    // P0 hardening (2026-05-09 audit): refuse to boot in production with the OWNER role.
    // The runtime MUST use deqah_app (NOBYPASSRLS). Using `:deqah:` in DATABASE_URL means
    // the app would silently bypass every RLS policy — defeating the whole tenant boundary.
    if (typeof value.DATABASE_URL === 'string') {
      // Match `:deqah:` or `://deqah:` but NOT `:deqah_app:` — split on '@' first to inspect creds only
      const creds = value.DATABASE_URL.split('@')[0] ?? '';
      if (/(?:^|\/\/|:)deqah:/.test(creds) && !/deqah_app:/.test(creds)) {
        return helpers.error('any.invalid', {
          message: 'DATABASE_URL uses the OWNER role (deqah). Production runtime MUST use the NOBYPASSRLS role (deqah_app). See docs/operations/p0-rls-cutover.md.',
        });
      }
    }
    // Single-tenant mode: RLS policies and GUC interceptor are not required.
    // The deqah_app role is still enforced, but without RLS policies the
    // interceptor is a no-op. Skipping the check allows single-company
    // deployments to boot without legacy SaaS infrastructure.
    // P0-8: production secret banlist - reject weak/default values at startup
    const BANNED_IN_PRODUCTION: Array<{ key: string; bannedValues?: string[]; bannedSubstrings?: string[] }> = [
      { key: 'JWT_SECRET', bannedValues: ['secret', 'change-me', 'development-secret', ''] },
      { key: 'APP_DB_PASSWORD', bannedValues: ['postgres', 'password', ''] },
      { key: 'MINIO_SECRET_KEY', bannedValues: ['minioadmin', ''] },
    ];
    for (const { key, bannedValues, bannedSubstrings } of BANNED_IN_PRODUCTION) {
      const v = (value as Record<string, unknown>)[key] as string | undefined;
      if (typeof v !== 'string') continue;
      if (bannedValues?.includes(v)) {
        return helpers.error('any.invalid', {
          message: `${key} must not use default/weak value in production`,
        });
      }
      if (bannedSubstrings?.some((s) => v.includes(s))) {
        return helpers.error('any.invalid', {
          message: `${key} must not contain '${bannedSubstrings}' in production`,
        });
      }
    }
    // P0-8: prevent sk_live_ keys in test-only env vars
    const liveKeyCheck = ['MOYASAR_TEST_SECRET_KEY'];
    for (const key of liveKeyCheck) {
      const v = (value as Record<string, unknown>)[key] as string | undefined;
      if (typeof v === 'string' && v.includes('sk_live_')) {
        return helpers.error('any.invalid', {
          message: `${key} must not use live key (sk_live_) in test config`,
        });
      }
    }

    return value;
  }, 'placeholder rejection in production');
