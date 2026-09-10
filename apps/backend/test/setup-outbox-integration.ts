/**
 * The transport lane deliberately has no setup-e2e mocks. It requires the
 * caller to provide an isolated Postgres and Redis pair and refuses to copy
 * an unvalidated DATABASE_URL into Prisma.
 */
const databaseUrl = process.env.REAL_E2E_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('REAL_E2E_DATABASE_URL is required for outbox integration tests.');
}

let parsed: URL;
try {
  parsed = new URL(databaseUrl);
} catch {
  throw new Error('REAL_E2E_DATABASE_URL must be a valid postgres URL.');
}
if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  throw new Error('REAL_E2E_DATABASE_URL must use the postgres/postgresql protocol.');
}
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
if (!databaseName || !/(test|e2e|sawaa_test)/i.test(databaseName)) {
  throw new Error('REAL_E2E_DATABASE_URL database name must be test-only.');
}
const target = `${parsed.hostname} ${databaseName}`.toLowerCase();
if (['prod', 'production', 'staging', 'stage', 'dev', 'development'].some((token) => target.includes(token))) {
  throw new Error('REAL_E2E_DATABASE_URL target is not allowed for integration tests.');
}

if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error('REDIS_HOST and REDIS_PORT are required for outbox integration tests.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(process.env.REDIS_HOST)) {
  throw new Error('Outbox fault injection only permits a local Redis target.');
}
const faultContainer = process.env.OUTBOX_TEST_REDIS_CONTAINER?.trim();
const faultPort = process.env.OUTBOX_TEST_REDIS_PORT?.trim();
if (!faultContainer || !/^[A-Za-z0-9_.:-]+$/.test(faultContainer)) {
  throw new Error('OUTBOX_TEST_REDIS_CONTAINER must identify the dedicated test Redis container.');
}
if (!faultPort || !/^\d+$/.test(faultPort) || faultPort !== process.env.REDIS_PORT) {
  throw new Error('OUTBOX_TEST_REDIS_PORT must match the dedicated Redis REDIS_PORT.');
}
if (!/(test|e2e|ci|safe)/i.test(process.env.OUTBOX_TEST_REDIS_TARGET ?? '')) {
  throw new Error('OUTBOX_TEST_REDIS_TARGET must identify a test-only fault target.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.THROTTLER_DISABLED = 'true';
