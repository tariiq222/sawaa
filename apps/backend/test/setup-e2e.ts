import { jest } from '@jest/globals';

// ─── Global E2E test setup ─────────────────────────────────────────────────
//
// This file runs once before the e2e test suite.  It stubs every external
// dependency (Redis, Sentry, e-mail/SMS providers, MinIO, Zoom, …) so that
// the Nest application can bootstrap without real infrastructure.

// Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    multi: jest.fn().mockReturnValue({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]]),
    }),
    flushdb: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn().mockResolvedValue('OK'),
  }));
});

// Throttler storage — must be before AppModule imports
jest.mock('@nest-lab/throttler-storage-redis', () => ({
  ThrottlerStorageRedisService: jest.fn().mockImplementation(() => ({
    addRecord: jest.fn().mockResolvedValue(undefined),
    getRecord: jest.fn().mockResolvedValue([]),
    deleteRecord: jest.fn().mockResolvedValue(undefined),
    clearExpiredRecords: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    redis: {
      on: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      ping: jest.fn().mockResolvedValue('PONG'),
    },
  })),
}));

// Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  withScope: jest.fn((cb) => cb({ setTag: jest.fn(), setUser: jest.fn() })),
  captureException: jest.fn(),
}));

// Shutdown state — never report shutting down in tests
jest.mock('../src/common/shutdown.state', () => ({
  setShuttingDown: jest.fn(),
  isShuttingDown: jest.fn().mockReturnValue(false),
}));

// MinIO
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue({ etag: 'etag' }),
    presignedGetObject: jest.fn().mockResolvedValue('https://cdn.example.com/file'),
    removeObject: jest.fn().mockResolvedValue(undefined),
    listObjectsV2: jest.fn().mockReturnValue([]),
  })),
}));

// Nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-1' }),
    verify: jest.fn().mockResolvedValue(true),
  }),
}));

// BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    getJob: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// OpenAI
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello' } }],
        }),
      },
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }],
      }),
    },
  })),
}));

// Zoom
jest.mock('../src/infrastructure/zoom/zoom-api.client', () => ({
  ZoomApiClient: jest.fn().mockImplementation(() => ({
    createMeeting: jest.fn().mockResolvedValue({ id: 123, join_url: 'https://zoom.us/j/123' }),
    deleteMeeting: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Global fetch stub for external APIs (Moyasar, Authentica, etc.)
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(''),
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
