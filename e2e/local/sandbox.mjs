import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { assertIsolatedDatabase } from './safety.mjs';

// Explicit opt-in only. Keys are supplied in a private, ignored file, never source.
assertIsolatedDatabase(process.env.DATABASE_URL);
if (!process.env.E2E_LOCAL_RUN_DIR) throw new Error('Run Sandbox setup through with-env.mjs');
const environmentPath = resolve(process.env.E2E_LOCAL_RUN_DIR, 'environment.json');
const environment = JSON.parse(readFileSync(environmentPath, 'utf8'));
if (environment.DATABASE_URL !== process.env.DATABASE_URL) throw new Error('Sandbox run environment mismatch');
const input = process.argv[2];
if (!input) throw new Error('Pass a private JSON file containing test publishableKey and secretKey');
const { publishableKey, secretKey } = JSON.parse(readFileSync(input, 'utf8'));
if (!/^pk_test_[A-Za-z0-9]+$/.test(publishableKey) || !/^sk_test_[A-Za-z0-9]+$/.test(secretKey)) {
  throw new Error('Only test credentials are permitted');
}
const response = await fetch('https://api.moyasar.com/v1/payments?per=1', {
  headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}` },
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`Sandbox authentication failed (${response.status}); no payment created`);
const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { ConfigService } = require('@nestjs/config');
const { MoyasarCredentialsService } = require('../../apps/backend/dist/src/infrastructure/payments/moyasar-credentials.service.js');
const { DEFAULT_ORG_ID, PAYMENT_CONFIG_SINGLETON_KEY } = require('../../apps/backend/dist/src/common/constants.js');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const creds = new MoyasarCredentialsService(new ConfigService(process.env));
  await prisma.organizationPaymentConfig.create({ data: {
    singletonKey: PAYMENT_CONFIG_SINGLETON_KEY, publishableKey, isLive: false,
    secretKeyEnc: creds.encrypt({ secretKey }, DEFAULT_ORG_ID),
    webhookSecretEnc: creds.encrypt({ webhookSecret: randomBytes(32).toString('hex') }, DEFAULT_ORG_ID),
  } });
  const settings = await prisma.organizationSettings.findFirstOrThrow();
  await prisma.organizationSettings.update({ where: { id: settings.id }, data: { paymentMoyasarEnabled: true } });
  environment.E2E_MOYASAR_PUBLISHABLE_KEY = publishableKey;
  writeFileSync(environmentPath, JSON.stringify(environment, null, 2), { mode: 0o600 });
  console.log('Sandbox credentials validated and enabled only in the isolated database');
} finally { await prisma.$disconnect(); }
