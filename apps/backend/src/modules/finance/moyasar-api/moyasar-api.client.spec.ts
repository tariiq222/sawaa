import { BadRequestException } from '@nestjs/common';
import { MoyasarApiClient } from './moyasar-api.client';

const ORG_ID = 'org-cache-test';

function makePrisma(secretKeyEnc = 'enc-key') {
  return {
    organizationPaymentConfig: {
      findUnique: jest.fn().mockResolvedValue(secretKeyEnc ? { secretKeyEnc } : null),
    },
  };
}

function makeCreds(secretKey = 'sk_live_abc') {
  return {
    decrypt: jest.fn().mockReturnValue({ secretKey }),
  };
}

function buildClient(
  prisma: ReturnType<typeof makePrisma>,
  creds: ReturnType<typeof makeCreds>,
) {
  return new MoyasarApiClient(prisma as never, creds as never);
}

describe('MoyasarApiClient — key cache', () => {
  it('fetches DB + decrypts on first call', async () => {
    const prisma = makePrisma();
    const creds = makeCreds();
    const client = buildClient(prisma, creds);

    // Access private via casting — test-only
    const key = await (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg(ORG_ID);

    expect(key).toBe('sk_live_abc');
    expect(prisma.organizationPaymentConfig.findUnique).toHaveBeenCalledTimes(1);
    expect(creds.decrypt).toHaveBeenCalledTimes(1);
  });

  it('returns cached key on second call without hitting DB', async () => {
    const prisma = makePrisma();
    const creds = makeCreds();
    const client = buildClient(prisma, creds);
    const getKey = (id: string) =>
      (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg(id);

    await getKey(ORG_ID);
    await getKey(ORG_ID);

    // Second call should hit the in-memory cache
    expect(prisma.organizationPaymentConfig.findUnique).toHaveBeenCalledTimes(1);
    expect(creds.decrypt).toHaveBeenCalledTimes(1);
  });

  it('re-fetches DB after invalidate()', async () => {
    const prisma = makePrisma();
    const creds = makeCreds();
    const client = buildClient(prisma, creds);
    const getKey = (id: string) =>
      (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg(id);

    await getKey(ORG_ID);
    client.invalidate(ORG_ID);
    await getKey(ORG_ID);

    // After invalidation, DB is called again
    expect(prisma.organizationPaymentConfig.findUnique).toHaveBeenCalledTimes(2);
    expect(creds.decrypt).toHaveBeenCalledTimes(2);
  });

  it('throws BadRequestException when org has no payment config', async () => {
    const prisma = {
      organizationPaymentConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const client = buildClient(prisma as never, makeCreds() as never);
    const getKey = (id: string) =>
      (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg(id);

    await expect(getKey('org-no-config')).rejects.toBeInstanceOf(BadRequestException);
  });
});
