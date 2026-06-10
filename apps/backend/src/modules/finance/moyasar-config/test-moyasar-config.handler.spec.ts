import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TestMoyasarConfigHandler } from './test-moyasar-config.handler';
import { PrismaService } from '../../../infrastructure/database';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';

describe('TestMoyasarConfigHandler', () => {
  let handler: TestMoyasarConfigHandler;
  let prisma: { organizationPaymentConfig: { findUnique: jest.Mock; update: jest.Mock } };
  let creds: { decrypt: jest.Mock };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    prisma = {
      organizationPaymentConfig: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    creds = { decrypt: jest.fn().mockReturnValue({ secretKey: 'sk_test_xxx' }) };

    const module = await Test.createTestingModule({
      providers: [
        TestMoyasarConfigHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: MoyasarCredentialsService, useValue: creds },
      ],
    }).compile();

    handler = module.get(TestMoyasarConfigHandler);
  });

  it('throws when no config exists', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);
    await expect(handler.execute()).rejects.toThrow(BadRequestException);
  });

  it('returns OK on 200', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue({ id: '1', secretKeyEnc: 'enc' });
    global.fetch = jest.fn().mockResolvedValue({ status: 200 });
    const result = await handler.execute();
    expect(result.ok).toBe(true);
    expect(result.status).toBe('OK');
    expect(prisma.organizationPaymentConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastVerifiedStatus: 'OK' }) }),
    );
  });

  it('returns INVALID_KEY on 401', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue({ id: '1', secretKeyEnc: 'enc' });
    global.fetch = jest.fn().mockResolvedValue({ status: 401 });
    const result = await handler.execute();
    expect(result.ok).toBe(false);
    expect(result.status).toBe('INVALID_KEY');
  });

  it('returns INVALID_KEY on 403', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue({ id: '1', secretKeyEnc: 'enc' });
    global.fetch = jest.fn().mockResolvedValue({ status: 403 });
    const result = await handler.execute();
    expect(result.ok).toBe(false);
    expect(result.status).toBe('INVALID_KEY');
  });

  it('returns HTTP status for other codes', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue({ id: '1', secretKeyEnc: 'enc' });
    global.fetch = jest.fn().mockResolvedValue({ status: 500 });
    const result = await handler.execute();
    expect(result.status).toBe('HTTP_500');
  });

  it('returns NETWORK_ERROR on fetch failure', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue({ id: '1', secretKeyEnc: 'enc' });
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    const result = await handler.execute();
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NETWORK_ERROR');
  });
});
