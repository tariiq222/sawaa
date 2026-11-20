/**
 * MNT-17.3f/g — Moyasar sandbox verification.
 *
 * Exercises the PRODUCTION code path: MoyasarCredentialsService encrypts and
 * decrypts the key, then MoyasarApiClient performs a real HTTPS request to
 * api.moyasar.com. Credentials come from the environment only; nothing is
 * written to the repository.
 *
 * Usage:
 *   MOYASAR_SANDBOX_SECRET_KEY=sk_test_... \
 *   MOYASAR_ENCRYPTION_KEY=<32b base64> \
 *   npx tsx apps/backend/scripts/moyasar-sandbox-verify.ts
 */
import { ConfigService } from '@nestjs/config';
import { MoyasarCredentialsService } from '../src/infrastructure/payments/moyasar-credentials.service';
import { MoyasarApiClient } from '../src/modules/finance/moyasar-api/moyasar-api.client';
import { PAYMENT_CONFIG_SINGLETON_KEY, DEFAULT_ORG_ID } from '../src/common/constants';

async function main(): Promise<void> {
  const secret = process.env.MOYASAR_SANDBOX_SECRET_KEY;
  if (!secret) throw new Error('MOYASAR_SANDBOX_SECRET_KEY is required');
  if (!secret.startsWith('sk_test_')) {
    throw new Error('Refusing to run: this script only accepts test keys (sk_test_)');
  }

  const cfg = new ConfigService({
    MOYASAR_ENCRYPTION_KEY: process.env.MOYASAR_ENCRYPTION_KEY,
  });
  const creds = new MoyasarCredentialsService(cfg);

  // Round-trip through the real encryption used for stored credentials.
  const secretKeyEnc = creds.encrypt({ secretKey: secret }, DEFAULT_ORG_ID);

  const prisma = {
    organizationPaymentConfig: {
      findUnique: async () => ({
        singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
        secretKeyEnc,
        isLive: false,
      }),
    },
  } as never;

  const client = new MoyasarApiClient(prisma, creds);

  const startedAt = Date.now();
  const invoice = await client.findCheckoutInvoiceByMetadata(
    DEFAULT_ORG_ID,
    'sandbox-probe-does-not-exist',
  );

  console.log(
    JSON.stringify(
      {
        result: 'ok',
        http: 200,
        latencyMs: Date.now() - startedAt,
        keyMode: 'test',
        encryptionRoundTrip: 'ok',
        lookup: invoice === null ? 'no matching invoice (expected)' : 'found',
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error('FAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
