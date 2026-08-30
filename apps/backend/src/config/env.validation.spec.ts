import { envValidationSchema } from './env.validation';
import {
  isProductionChatGuestTokenSecretPlaceholder,
  NON_PRODUCTION_CHAT_GUEST_TOKEN_SECRET_FIXTURES,
} from './guest-chat-token-secret.policy';

// Non-zero 32-byte key, base64 — `Buffer.alloc(32)` would be all-zero, which
// the env validator (P0-14) rejects in production as trivially decryptable.
const base64_44 = Buffer.from(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'hex',
).toString('base64');

const baseValidEnv = {
  NODE_ENV: 'production',
  PORT: '5200',
  DATABASE_URL:
    'postgresql://deqah_app:pass@localhost:5432/db?connection_limit=10&pool_timeout=20',
  DB_STATEMENT_TIMEOUT_MS: '30000',
  DB_POOL_TIMEOUT_S: '20',
  DB_CONNECTION_LIMIT: '10',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: '',
  REDIS_DB: '0',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_ACCESS_KEY: 'minio',
  MINIO_SECRET_KEY: 'minio-secret-123',
  MINIO_BUCKET: 'bucket',
  MINIO_USE_SSL: 'false',
  JWT_ACCESS_SECRET: 'a-very-long-and-secure-jwt-access-secret-32b',
  JWT_REFRESH_SECRET: 'a-very-long-and-secure-jwt-refresh-secret-32b',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  JWT_CLIENT_ACCESS_SECRET: 'a-very-long-and-secure-client-access-secret',
  JWT_CLIENT_ACCESS_TTL: '15m',
  CHAT_GUEST_TOKEN_SECRET: 'a-very-long-and-secure-chat-guest-token-secret',
  MOYASAR_ENCRYPTION_KEY: base64_44,
  AI_PROVIDER_ENCRYPTION_KEY: base64_44,
  SMS_PROVIDER_ENCRYPTION_KEY: base64_44,
  ZOOM_PROVIDER_ENCRYPTION_KEY: base64_44,
  EMAIL_PROVIDER_ENCRYPTION_KEY: base64_44,
  PLATFORM_SETTINGS_KEY: 'a'.repeat(64),
  SUPER_ADMIN_PASSWORD: 'SuperSecurePassword123!',
  THROTTLER_DISABLED: 'false',
  MOBILE_OTP_FULL_BYPASS: 'false',
  JWT_OTP_SECRET: 'a-very-long-and-secure-otp-secret-32b',
  JWT_CLIENT_REFRESH_TTL: '7d',
  DASHBOARD_PUBLIC_URL: 'https://app.example.com',
  API_PUBLIC_URL: 'https://api.example.com',
  PUBLIC_WEBSITE_URL: 'https://www.example.com',
  AUTHENTICA_API_KEY: 'authentica-api-key-123',
  AUTHENTICA_BASE_URL: 'https://api.authentica.sa',
  AUTHENTICA_DEFAULT_TEMPLATE_ID: '1',
  INTERNAL_METRICS_ALLOWED_IPS: '127.0.0.1',
  INTERNAL_METRICS_TOKEN: 'internal-metrics-token-that-is-very-long-32b',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  OPENROUTER_CHAT_MODEL: 'anthropic/claude-3.5-haiku',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  SMTP_PORT: '587',
};

const buildDevEnv = (overrides: Record<string, string | undefined> = {}) => ({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost/db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_ACCESS_KEY: 'minio',
  MINIO_SECRET_KEY: 'minio-secret-123',
  MINIO_BUCKET: 'bucket',
  JWT_ACCESS_SECRET: 'a-very-long-and-secure-jwt-access-secret-32b',
  JWT_REFRESH_SECRET: 'a-very-long-and-secure-jwt-refresh-secret-32b',
  JWT_CLIENT_ACCESS_SECRET: 'a-very-long-and-secure-client-access-secret',
  CHAT_GUEST_TOKEN_SECRET: 'a-very-long-and-secure-chat-guest-token-secret',
  MOYASAR_ENCRYPTION_KEY: base64_44,
  AI_PROVIDER_ENCRYPTION_KEY: base64_44,
  SMS_PROVIDER_ENCRYPTION_KEY: base64_44,
  ZOOM_PROVIDER_ENCRYPTION_KEY: base64_44,
  EMAIL_PROVIDER_ENCRYPTION_KEY: base64_44,
  ...overrides,
});

describe('envValidationSchema', () => {
  it('requires a valid 32-byte AI provider encryption key', () => {
    const invalid = envValidationSchema.validate({ AI_PROVIDER_ENCRYPTION_KEY: '' }, { abortEarly: false });
    expect(invalid.error?.details.some((d) => d.path.includes('AI_PROVIDER_ENCRYPTION_KEY'))).toBe(true);
  });

  it('accepts the known non-zero 32-byte AI provider test key', () => {
    const result = envValidationSchema.validate({ AI_PROVIDER_ENCRYPTION_KEY: base64_44 }, { abortEarly: false });
    expect(result.error?.details.some((d) => d.path.includes('AI_PROVIDER_ENCRYPTION_KEY'))).toBe(false);
  });

  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('passes with valid production env', () => {
    process.env.NODE_ENV = 'production';
    const result = envValidationSchema.validate(baseValidEnv, {
      abortEarly: false,
    });
    expect(result.error).toBeUndefined();
  });

  it('accepts CHAT_MAX_MESSAGE_LENGTH=4000 and rejects 4001', () => {
    const accepted = envValidationSchema.validate(
      { ...baseValidEnv, CHAT_MAX_MESSAGE_LENGTH: '4000' },
      { abortEarly: false },
    );
    const rejected = envValidationSchema.validate(
      { ...baseValidEnv, CHAT_MAX_MESSAGE_LENGTH: '4001' },
      { abortEarly: false },
    );

    expect(accepted.error).toBeUndefined();
    expect(rejected.error?.details.some((detail) => detail.path.includes('CHAT_MAX_MESSAGE_LENGTH'))).toBe(true);
  });

  it('applies safe defaults for the complete web-chat runtime contract', () => {
    const result = envValidationSchema.validate(baseValidEnv, { abortEarly: false });

    expect(result.error).toBeUndefined();
    expect(result.value).toEqual(expect.objectContaining({
      APP_VERSION: '2.1.9',
      GIT_SHA: 'unknown',
      WEB_CHAT_ENABLED: false,
      CHAT_MAX_MESSAGE_LENGTH: 4000,
      CHAT_RATE_LIMIT_PER_MINUTE: 20,
      CHAT_DAILY_TOKEN_BUDGET: 100000,
      CHAT_GUEST_SESSION_DAYS: 30,
      RETENTION_CHAT_DAYS: 365,
    }));
  });

  it('accepts configured non-sensitive build metadata', () => {
    const result = envValidationSchema.validate({
      ...baseValidEnv,
      APP_VERSION: '2.2.0',
      GIT_SHA: 'a1b2c3d',
    }, { abortEarly: false });

    expect(result.error).toBeUndefined();
    expect(result.value).toEqual(expect.objectContaining({
      APP_VERSION: '2.2.0',
      GIT_SHA: 'a1b2c3d',
    }));
  });

  it('allows metadata to be omitted or supplied as empty Docker build values', () => {
    const result = envValidationSchema.validate({
      ...baseValidEnv,
      APP_VERSION: '',
      GIT_SHA: '',
    }, { abortEarly: false });

    expect(result.error).toBeUndefined();
  });

  it.each([
    ['CHAT_RATE_LIMIT_PER_MINUTE', '0'],
    ['CHAT_DAILY_TOKEN_BUDGET', '0'],
    ['CHAT_GUEST_SESSION_DAYS', '0'],
    ['RETENTION_CHAT_DAYS', '0'],
  ])('rejects a non-positive %s', (key, value) => {
    const result = envValidationSchema.validate(
      { ...baseValidEnv, [key]: value },
      { abortEarly: false },
    );
    expect(result.error?.details.some((detail) => detail.path.includes(key))).toBe(true);
  });

  it('rejects a missing CHAT_GUEST_TOKEN_SECRET at startup', () => {
    const result = envValidationSchema.validate(
      { ...baseValidEnv, CHAT_GUEST_TOKEN_SECRET: undefined },
      { abortEarly: false },
    );
    expect(result.error?.details.some((d) => d.path.includes('CHAT_GUEST_TOKEN_SECRET'))).toBe(true);
  });

  it('rejects a weak CHAT_GUEST_TOKEN_SECRET at startup', () => {
    const result = envValidationSchema.validate(
      { ...baseValidEnv, CHAT_GUEST_TOKEN_SECRET: 'too-short' },
      { abortEarly: false },
    );
    expect(result.error?.details.some((d) => d.path.includes('CHAT_GUEST_TOKEN_SECRET'))).toBe(true);
  });

  it('rejects a production placeholder CHAT_GUEST_TOKEN_SECRET', () => {
    const result = envValidationSchema.validate(
      { ...baseValidEnv, CHAT_GUEST_TOKEN_SECRET: 'change-me-chat-guest-token-secret-123456' },
      { abortEarly: false },
    );
    expect(result.error?.details.some((d) => d.context?.message?.includes('CHAT_GUEST_TOKEN_SECRET'))).toBe(true);
  });

  it.each([
    'change.me-chat-guest-token-secret-123456',
    'change me-chat-guest-token-secret-123456',
    'replace.me-chat-guest-token-secret-123456',
  ])('rejects the legacy production guest token placeholder %s', (secret) => {
    const result = envValidationSchema.validate(
      { ...baseValidEnv, CHAT_GUEST_TOKEN_SECRET: secret },
      { abortEarly: false },
    );
    expect(result.error?.details.some((d) => d.context?.message?.includes('CHAT_GUEST_TOKEN_SECRET'))).toBe(true);
  });

  it.each(NON_PRODUCTION_CHAT_GUEST_TOKEN_SECRET_FIXTURES)(
    'rejects the non-production guest token fixture %s in production',
    (fixture) => {
      const result = envValidationSchema.validate(
        { ...baseValidEnv, CHAT_GUEST_TOKEN_SECRET: fixture },
        { abortEarly: false },
      );
      expect(result.error?.details.some((d) => d.context?.message?.includes('CHAT_GUEST_TOKEN_SECRET'))).toBe(true);
    },
  );

  it.each(NON_PRODUCTION_CHAT_GUEST_TOKEN_SECRET_FIXTURES)(
    'allows the non-production guest token fixture %s outside production',
    (fixture) => {
      const result = envValidationSchema.validate(
        buildDevEnv({ CHAT_GUEST_TOKEN_SECRET: fixture }),
        { abortEarly: false },
      );
      expect(result.error).toBeUndefined();
    },
  );

  it('allows a strong guest token secret that starts with testing in production', () => {
    const result = envValidationSchema.validate(
      {
        ...baseValidEnv,
        CHAT_GUEST_TOKEN_SECRET: 'testing-is-a-valid-strong-guest-token-secret-32chars',
      },
      { abortEarly: false },
    );
    expect(result.error).toBeUndefined();
  });

  it.each([
    ...NON_PRODUCTION_CHAT_GUEST_TOKEN_SECRET_FIXTURES,
    'change-me-chat-guest-token-secret-123456',
    'change.me-chat-guest-token-secret-123456',
    'change me-chat-guest-token-secret-123456',
    'REPLACE_ME-chat-guest-token-secret-123456',
    'replace.me-chat-guest-token-secret-123456',
  ])('identifies %s as a production guest token placeholder', (secret) => {
    expect(isProductionChatGuestTokenSecretPlaceholder(secret)).toBe(true);
  });

  it('does not identify a strong testing-prefixed secret as a placeholder', () => {
    expect(
      isProductionChatGuestTokenSecretPlaceholder(
        'testing-is-a-valid-strong-guest-token-secret-32chars',
      ),
    ).toBe(false);
  });

  it('passes with minimal development env', () => {
    process.env.NODE_ENV = 'development';
    const result = envValidationSchema.validate(buildDevEnv(), {
      abortEarly: false,
    });
    expect(result.error).toBeUndefined();
  });

  describe('NODE_ENV', () => {
    it('rejects invalid NODE_ENV values', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, NODE_ENV: 'invalid-env' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) => d.path.includes('NODE_ENV')),
      ).toBe(true);
    });
  });

  describe('DATABASE_URL production checks', () => {
    it('fails when connection_limit is missing in production', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        DATABASE_URL:
          'postgresql://deqah_app:pass@localhost:5432/db?pool_timeout=20',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) => d.path.includes('DATABASE_URL') && d.type === 'any.invalid',
        ),
      ).toBe(true);
    });

    it('fails when pool_timeout is missing in production', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        DATABASE_URL:
          'postgresql://deqah_app:pass@localhost:5432/db?connection_limit=10',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) => d.path.includes('DATABASE_URL') && d.type === 'any.invalid',
        ),
      ).toBe(true);
    });

    it('passes without connection_limit/pool_timeout in development', () => {
      process.env.NODE_ENV = 'development';
      const env = buildDevEnv();
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('SUPER_ADMIN_PASSWORD', () => {
    it("rejects 'Admin@2026' in production", () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, SUPER_ADMIN_PASSWORD: 'Admin@2026' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
    });

    it("rejects 'admin' in production", () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, SUPER_ADMIN_PASSWORD: 'admin' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
    });

    it("rejects 'password' in production", () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, SUPER_ADMIN_PASSWORD: 'password' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
    });
  });

  describe('THROTTLER_DISABLED', () => {
    it('rejects true in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, THROTTLER_DISABLED: 'true' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) => d.path.includes('THROTTLER_DISABLED')),
      ).toBe(true);
    });

    it('allows true in development', () => {
      process.env.NODE_ENV = 'development';
      const env = buildDevEnv({ THROTTLER_DISABLED: 'true' });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('MOBILE_OTP_FULL_BYPASS', () => {
    it('rejects true in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, MOBILE_OTP_FULL_BYPASS: 'true' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('MOBILE_OTP_FULL_BYPASS'),
        ),
      ).toBe(true);
    });

    it('allows true in development', () => {
      process.env.NODE_ENV = 'development';
      const env = buildDevEnv({ MOBILE_OTP_FULL_BYPASS: 'true' });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('MOBILE_OTP_DEV_BYPASS_CODE', () => {
    it('is forbidden in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, MOBILE_OTP_DEV_BYPASS_CODE: '123456' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('MOBILE_OTP_DEV_BYPASS_CODE'),
        ),
      ).toBe(true);
    });

    it('is allowed in development', () => {
      process.env.NODE_ENV = 'development';
      const env = buildDevEnv({ MOBILE_OTP_DEV_BYPASS_CODE: '123456' });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('JWT_OTP_SECRET', () => {
    it('is required in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, JWT_OTP_SECRET: undefined };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) => d.path.includes('JWT_OTP_SECRET')),
      ).toBe(true);
    });

    it('is required in staging', () => {
      process.env.NODE_ENV = 'staging';
      const env = buildDevEnv({
        NODE_ENV: 'staging',
        JWT_OTP_SECRET: undefined,
      });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) => d.path.includes('JWT_OTP_SECRET')),
      ).toBe(true);
    });

    it('is optional in development', () => {
      process.env.NODE_ENV = 'development';
      const env = buildDevEnv({ JWT_OTP_SECRET: '' });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });

    it('is optional in test', () => {
      process.env.NODE_ENV = 'test';
      const env = buildDevEnv({ NODE_ENV: 'test', JWT_OTP_SECRET: '' });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('public URLs must be https in production', () => {
    it('rejects http DASHBOARD_PUBLIC_URL in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, DASHBOARD_PUBLIC_URL: 'http://app.example.com' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('DASHBOARD_PUBLIC_URL'),
        ),
      ).toBe(true);
    });

    it('rejects http API_PUBLIC_URL in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, API_PUBLIC_URL: 'http://api.example.com' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) => d.path.includes('API_PUBLIC_URL')),
      ).toBe(true);
    });

    it('rejects http PUBLIC_WEBSITE_URL in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, PUBLIC_WEBSITE_URL: 'http://www.example.com' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('PUBLIC_WEBSITE_URL'),
        ),
      ).toBe(true);
    });

    it('allows http in development', () => {
      process.env.NODE_ENV = 'development';
      const env = buildDevEnv({
        DASHBOARD_PUBLIC_URL: 'http://localhost:3000',
        API_PUBLIC_URL: 'http://localhost:5200',
        PUBLIC_WEBSITE_URL: 'http://localhost:3001',
      });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('AUTHENTICA_API_KEY', () => {
    it('is required in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, AUTHENTICA_API_KEY: undefined };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('AUTHENTICA_API_KEY'),
        ),
      ).toBe(true);
    });

    it('is optional in development', () => {
      process.env.NODE_ENV = 'development';
      const env = buildDevEnv({ AUTHENTICA_API_KEY: '' });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('INTERNAL_METRICS_ALLOWED_IPS', () => {
    it('is required in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, INTERNAL_METRICS_ALLOWED_IPS: undefined };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('INTERNAL_METRICS_ALLOWED_IPS'),
        ),
      ).toBe(true);
    });
  });

  describe('INTERNAL_METRICS_TOKEN', () => {
    it('is required in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, INTERNAL_METRICS_TOKEN: undefined };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('INTERNAL_METRICS_TOKEN'),
        ),
      ).toBe(true);
    });

    it('rejects short token in production', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, INTERNAL_METRICS_TOKEN: 'short' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('INTERNAL_METRICS_TOKEN'),
        ),
      ).toBe(true);
    });
  });

  describe('placeholder rejection in production', () => {
    it('rejects JWT_ACCESS_SECRET containing change-me', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        JWT_ACCESS_SECRET: 'change-me-123456789',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('JWT_ACCESS_SECRET'),
        ),
      ).toBe(true);
    });

    it('rejects JWT_REFRESH_SECRET containing CHANGE_ME', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        JWT_REFRESH_SECRET: 'CHANGE_ME_123456789',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('JWT_REFRESH_SECRET'),
        ),
      ).toBe(true);
    });

    it('rejects JWT_OTP_SECRET containing REPLACE_ME', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        JWT_OTP_SECRET: 'REPLACE_ME_123456789',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('JWT_OTP_SECRET'),
        ),
      ).toBe(true);
    });

    it('rejects JWT_CLIENT_ACCESS_SECRET containing dev-', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        JWT_CLIENT_ACCESS_SECRET: 'dev-secret-123456789',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('JWT_CLIENT_ACCESS_SECRET'),
        ),
      ).toBe(true);
    });

    it('rejects AUTHENTICA_API_KEY containing sk_test_', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        AUTHENTICA_API_KEY: 'sk_test_123456789012',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('AUTHENTICA_API_KEY'),
        ),
      ).toBe(true);
    });

    it('allows placeholders in development', () => {
      process.env.NODE_ENV = 'development';
      const env = buildDevEnv({ JWT_ACCESS_SECRET: 'change-me-123456789' });
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('DATABASE_URL owner role check', () => {
    it('rejects OWNER role (deqah) in production', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        DATABASE_URL:
          'postgresql://deqah:pass@localhost:5432/db?connection_limit=10&pool_timeout=20',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('OWNER'),
        ),
      ).toBe(true);
    });

    it('allows deqah_app role in production', () => {
      process.env.NODE_ENV = 'production';
      const env = {
        ...baseValidEnv,
        DATABASE_URL:
          'postgresql://deqah_app:pass@localhost:5432/db?connection_limit=10&pool_timeout=20',
      };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeUndefined();
    });
  });

  describe('BANNED_IN_PRODUCTION values', () => {
    it('rejects JWT_SECRET with banned value', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, JWT_SECRET: 'secret' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('JWT_SECRET'),
        ),
      ).toBe(true);
    });

    it('rejects APP_DB_PASSWORD with banned value', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, APP_DB_PASSWORD: 'postgres' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('APP_DB_PASSWORD'),
        ),
      ).toBe(true);
    });

    it('rejects MINIO_SECRET_KEY with banned value', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, MINIO_SECRET_KEY: 'minioadmin' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('MINIO_SECRET_KEY'),
        ),
      ).toBe(true);
    });

    it('rejects empty MINIO_SECRET_KEY', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, MINIO_SECRET_KEY: '' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some((d) =>
          d.path.includes('MINIO_SECRET_KEY'),
        ),
      ).toBe(true);
    });
  });

  describe('live key check', () => {
    it('rejects sk_live_ in MOYASAR_TEST_SECRET_KEY', () => {
      process.env.NODE_ENV = 'production';
      const env = { ...baseValidEnv, MOYASAR_TEST_SECRET_KEY: 'sk_live_123' };
      const result = envValidationSchema.validate(env, { abortEarly: false });
      expect(result.error).toBeDefined();
      expect(
        result.error?.details.some(
          (d) =>
            d.type === 'any.invalid' &&
            d.context?.message?.includes('MOYASAR_TEST_SECRET_KEY'),
        ),
      ).toBe(true);
    });
  });
});
