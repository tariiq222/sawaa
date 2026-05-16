import { jest } from '@jest/globals';

// ─── Global E2E test setup ─────────────────────────────────────────────────
//
// This file runs once before the e2e test suite.  It stubs every external
// dependency (Redis, Sentry, e-mail/SMS providers, MinIO, Zoom, …) so that
// the Nest application can bootstrap without real infrastructure.

// Helper: jest.fn() from @jest/globals types mockResolvedValue as `never`
// when the function signature is unknown. Cast once to avoid `as any` noise.
const fn = jest.fn as (...args: any[]) => jest.Mock<any>;

// Redis
jest.mock('ioredis', () => {
  return fn().mockImplementation(() => ({
    on: fn(),
    get: fn().mockResolvedValue(null),
    set: fn().mockResolvedValue('OK'),
    setex: fn().mockResolvedValue('OK'),
    del: fn().mockResolvedValue(1),
    incr: fn().mockResolvedValue(1),
    expire: fn().mockResolvedValue(1),
    multi: fn().mockReturnValue({
      incr: fn().mockReturnThis(),
      expire: fn().mockReturnThis(),
      exec: fn().mockResolvedValue([[null, 1], [null, 1]]),
    }),
    flushdb: fn().mockResolvedValue('OK'),
    ping: fn().mockResolvedValue('PONG'),
    quit: fn().mockResolvedValue('OK'),
    disconnect: fn().mockResolvedValue('OK'),
  }));
});

// Throttler storage — must be before AppModule imports
jest.mock('@nest-lab/throttler-storage-redis', () => ({
  ThrottlerStorageRedisService: fn().mockImplementation(() => ({
    addRecord: fn().mockResolvedValue(undefined),
    getRecord: fn().mockResolvedValue([]),
    deleteRecord: fn().mockResolvedValue(undefined),
    clearExpiredRecords: fn().mockResolvedValue(undefined),
    close: fn().mockResolvedValue(undefined),
    on: fn(),
    redis: {
      on: fn(),
      get: fn().mockResolvedValue(null),
      set: fn().mockResolvedValue('OK'),
      del: fn().mockResolvedValue(1),
      ping: fn().mockResolvedValue('PONG'),
    },
  })),
}));

// Sentry
jest.mock('@sentry/node', () => ({
  init: fn(),
  withScope: fn((cb: any) => cb({ setTag: fn(), setUser: fn() })),
  captureException: fn(),
}));

// Shutdown state — never report shutting down in tests
jest.mock('../src/common/shutdown.state', () => ({
  setShuttingDown: fn(),
  isShuttingDown: fn().mockReturnValue(false),
}));

// MinIO
jest.mock('minio', () => ({
  Client: fn().mockImplementation(() => ({
    bucketExists: fn().mockResolvedValue(true),
    makeBucket: fn().mockResolvedValue(undefined),
    putObject: fn().mockResolvedValue({ etag: 'etag' }),
    presignedGetObject: fn().mockResolvedValue('https://cdn.example.com/file'),
    removeObject: fn().mockResolvedValue(undefined),
    listObjectsV2: fn().mockReturnValue([]),
  })),
}));

// Nodemailer
jest.mock('nodemailer', () => ({
  createTransport: fn().mockReturnValue({
    sendMail: fn().mockResolvedValue({ messageId: 'msg-1' }),
    verify: fn().mockResolvedValue(true),
  }),
}));

// BullMQ
jest.mock('bullmq', () => ({
  Queue: fn().mockImplementation(() => ({
    add: fn().mockResolvedValue({ id: 'job-1' }),
    getJob: fn().mockResolvedValue(null),
    close: fn().mockResolvedValue(undefined),
  })),
  Worker: fn().mockImplementation(() => ({
    on: fn(),
    close: fn().mockResolvedValue(undefined),
  })),
  QueueEvents: fn().mockImplementation(() => ({
    on: fn(),
    close: fn().mockResolvedValue(undefined),
  })),
}));

// OpenAI
jest.mock('openai', () => ({
  __esModule: true,
  default: fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello' } }],
        }),
      },
    },
    embeddings: {
      create: fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }],
      }),
    },
  })),
}));

// Zoom
jest.mock('../src/infrastructure/zoom/zoom-api.client', () => ({
  ZoomApiClient: fn().mockImplementation(() => ({
    createMeeting: fn().mockResolvedValue({ id: 123, join_url: 'https://zoom.us/j/123' }),
    deleteMeeting: fn().mockResolvedValue(undefined),
  })),
}));

// Global fetch stub for external APIs (Moyasar, Authentica, etc.)
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: fn().mockResolvedValue({}),
    text: fn().mockResolvedValue(''),
  }) as any;
});

afterAll(() => {
  global.fetch = originalFetch;
});

// Required env vars for bootstrap
process.env.NODE_ENV = 'test';
process.env.THROTTLER_DISABLED = 'true';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-key-for-e2e-tests-only';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-e2e-tests-only';
process.env.PLATFORM_SETTINGS_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_USE_SSL = 'false';
process.env.MINIO_ACCESS_KEY = 'test';
process.env.MINIO_SECRET_KEY = 'test';
process.env.MINIO_BUCKET = 'test';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test';
process.env.SMTP_PASS = 'test';
process.env.SMS_PROVIDER = 'NONE';
process.env.OPENAI_API_KEY = 'sk-test';
process.env.MOYASAR_SECRET_KEY = 'sk_test_dC1t7MVaXhJUmfwSj3QDpT2yRuRSMmdsjQB71zxo';
process.env.MOYASAR_PUBLISHABLE_KEY = 'pk_test_9WmjNQjvWeKh67QscDUg7Y7YGpuvcpDY9ugi3qkv';
