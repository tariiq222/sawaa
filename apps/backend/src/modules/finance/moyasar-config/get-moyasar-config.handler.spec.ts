import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetMoyasarConfigHandler } from './get-moyasar-config.handler';

describe('GetMoyasarConfigHandler', () => {
  let handler: GetMoyasarConfigHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMoyasarConfigHandler,
        { provide: PrismaService, useValue: {
          organizationPaymentConfig: { findFirst: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<GetMoyasarConfigHandler>(GetMoyasarConfigHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return null when no config', async () => {
    (prisma.organizationPaymentConfig.findFirst as jest.Mock).mockResolvedValue(null);
    const result = await handler.execute();
    expect(result).toBeNull();
  });

  it('should return masked config for live key', async () => {
    (prisma.organizationPaymentConfig.findFirst as jest.Mock).mockResolvedValue({
      publishableKey: 'pk_live_abc1234',
      secretKeyEnc: 'encrypted',
      webhookSecretEnc: 'whsec',
      isLive: true,
      lastVerifiedAt: new Date(),
      lastVerifiedStatus: 'ok',
      updatedAt: new Date(),
    });
    const result = await handler.execute();
    expect(result?.secretKeyMasked).toContain('live');
  });

  it('should return masked config for test key', async () => {
    (prisma.organizationPaymentConfig.findFirst as jest.Mock).mockResolvedValue({
      publishableKey: 'pk_test_xyz5678',
      secretKeyEnc: 'encrypted',
      webhookSecretEnc: null,
      isLive: false,
      lastVerifiedAt: null,
      lastVerifiedStatus: null,
      updatedAt: new Date(),
    });
    const result = await handler.execute();
    expect(result?.hasWebhookSecret).toBe(false);
  });
});
